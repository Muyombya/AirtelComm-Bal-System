import { pool } from "../config/database.js";

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${label} must be a valid ID.`);
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export async function listServiceProviders(_req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, service_name, status
       FROM service_providers
       ORDER BY name, id`
    );
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function listTills(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, branch_id, name, operating_capital, status
       FROM tills
       WHERE ($1::bigint IS NULL OR branch_id=$1)
       ORDER BY name, id`,
      [req.user.role === "MANAGER" ? null : req.user.branch_id]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function listTerminals(req, res, next) {
  try {
    const providerId = req.query.providerId ? positiveId(req.query.providerId, "Provider ID") : null;
    const branchId = req.query.branchId ? positiveId(req.query.branchId, "Branch ID") : null;

    const result = await pool.query(
      `SELECT t.id, t.name, t.outlet_id, t.account_number, t.status,
              sp.id AS service_provider_id, sp.name AS service_provider_name,
              b.id AS branch_id, b.name AS branch_name,
              tba.active_from AS branch_assigned_from
       FROM terminals t
       JOIN service_providers sp ON sp.id = t.service_provider_id
       LEFT JOIN terminal_branch_assignments tba
         ON tba.terminal_id = t.id AND tba.active_to IS NULL
       LEFT JOIN branches b ON b.id = tba.branch_id
       WHERE ($1::bigint IS NULL OR t.service_provider_id = $1)
         AND ($2::bigint IS NULL OR tba.branch_id = $2)
       ORDER BY b.name NULLS LAST, sp.name, t.name, t.id`,
      [providerId, branchId]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function createTerminal(req, res, next) {
  const client = await pool.connect();
  try {
    const serviceProviderId = positiveId(req.body.serviceProviderId, "Service Provider ID");
    const branchId = positiveId(req.body.branchId, "Branch ID");
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Terminal name is required." });

    await client.query("BEGIN");

    const provider = await client.query(
      "SELECT id FROM service_providers WHERE id = $1 AND status = 'ACTIVE'",
      [serviceProviderId]
    );
    if (provider.rowCount === 0) {
      const error = new Error("Active service provider not found.");
      error.statusCode = 400;
      throw error;
    }

    const branch = await client.query(
      "SELECT id FROM branches WHERE id = $1",
      [branchId]
    );
    if (branch.rowCount === 0) {
      const error = new Error("Branch not found.");
      error.statusCode = 400;
      throw error;
    }

    const terminalResult = await client.query(
      `INSERT INTO terminals
         (service_provider_id, name, outlet_id, account_number, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING id, service_provider_id, name, outlet_id, account_number, status, created_at`,
      [serviceProviderId, name, clean(req.body.outletId), clean(req.body.accountNumber)]
    );

    const terminal = terminalResult.rows[0];

    await client.query(
      `INSERT INTO terminal_branch_assignments (terminal_id, branch_id, active_from)
       VALUES ($1, $2, NOW())`,
      [terminal.id, branchId]
    );

    await client.query("COMMIT");
    res.status(201).json({ ...terminal, branch_id: branchId });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

export async function updateTerminal(req, res, next) {
  try {
    const id = positiveId(req.params.id, "Terminal ID");
    const serviceProviderId = positiveId(req.body.serviceProviderId, "Service Provider ID");
    const name = String(req.body.name ?? "").trim();
    const status = String(req.body.status ?? "").trim().toUpperCase();
    if (!name) return res.status(400).json({ error: "Terminal name is required." });
    if (!["ACTIVE", "INACTIVE"].includes(status)) return res.status(400).json({ error: "Status must be ACTIVE or INACTIVE." });

    const provider = await pool.query("SELECT id FROM service_providers WHERE id = $1", [serviceProviderId]);
    if (provider.rowCount === 0) return res.status(400).json({ error: "Service provider not found." });

    const result = await pool.query(
      `UPDATE terminals SET service_provider_id = $1, name = $2, outlet_id = $3,
       account_number = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, service_provider_id, name, outlet_id, account_number, status, updated_at`,
      [serviceProviderId, name, clean(req.body.outletId), clean(req.body.accountNumber), status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Terminal not found." });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function transferTerminal(req, res, next) {
  const client = await pool.connect();
  try {
    const terminalId = positiveId(req.params.id, "Terminal ID");
    const targetBranchId = positiveId(req.body.branchId, "Branch ID");

    await client.query("BEGIN");

    const terminal = await client.query(
      `SELECT id, status
       FROM terminals
       WHERE id = $1
       FOR UPDATE`,
      [terminalId]
    );
    if (terminal.rowCount === 0) {
      const error = new Error("Terminal not found.");
      error.statusCode = 404;
      throw error;
    }
    if (terminal.rows[0].status !== "ACTIVE") {
      const error = new Error("Only an active terminal can be transferred.");
      error.statusCode = 400;
      throw error;
    }

    const branch = await client.query("SELECT id, name FROM branches WHERE id = $1", [targetBranchId]);
    if (branch.rowCount === 0) {
      const error = new Error("Target branch not found.");
      error.statusCode = 400;
      throw error;
    }

    const current = await client.query(
      `SELECT id, branch_id
       FROM terminal_branch_assignments
       WHERE terminal_id = $1 AND active_to IS NULL
       FOR UPDATE`,
      [terminalId]
    );

    if (current.rowCount > 0 && Number(current.rows[0].branch_id) === targetBranchId) {
      await client.query("COMMIT");
      return res.json({ message: "Terminal is already assigned to this branch.", branch_id: targetBranchId });
    }

    if (current.rowCount > 0) {
      await client.query(
        `UPDATE terminal_branch_assignments
         SET active_to = NOW()
         WHERE id = $1`,
        [current.rows[0].id]
      );
    }

    // A transfer ends any active Till assignment in the old branch.
    // The historical Till assignment remains intact.
    await client.query(
      `UPDATE till_terminals tt
       SET active_to = NOW()
       FROM tills ti
       WHERE tt.till_id = ti.id
         AND tt.terminal_id = $1
         AND tt.active_to IS NULL`,
      [terminalId]
    );

    await client.query(
      `INSERT INTO terminal_branch_assignments (terminal_id, branch_id, active_from)
       VALUES ($1, $2, NOW())`,
      [terminalId, targetBranchId]
    );

    await client.query("COMMIT");
    res.json({ message: "Terminal transferred successfully.", branch_id: targetBranchId, branch_name: branch.rows[0].name });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

export async function removeTerminalFromBranch(req, res, next) {
  const client = await pool.connect();
  try {
    const terminalId = positiveId(req.params.id, "Terminal ID");
    await client.query("BEGIN");

    const terminal = await client.query(
      `SELECT id, status
       FROM terminals
       WHERE id = $1
       FOR UPDATE`,
      [terminalId]
    );
    if (terminal.rowCount === 0) {
      const error = new Error("Terminal not found.");
      error.statusCode = 404;
      throw error;
    }

    const current = await client.query(
      `SELECT id, branch_id
       FROM terminal_branch_assignments
       WHERE terminal_id = $1 AND active_to IS NULL
       FOR UPDATE`,
      [terminalId]
    );
    if (current.rowCount === 0) {
      const error = new Error("Terminal is not currently assigned to a branch.");
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      `UPDATE terminal_branch_assignments SET active_to = NOW() WHERE id = $1`,
      [current.rows[0].id]
    );

    await client.query(
      `UPDATE till_terminals SET active_to = NOW()
       WHERE terminal_id = $1 AND active_to IS NULL`,
      [terminalId]
    );

    await client.query(
      `UPDATE terminals SET status = 'INACTIVE', updated_at = NOW() WHERE id = $1`,
      [terminalId]
    );

    await client.query("COMMIT");
    res.json({ message: "Terminal removed from its branch and deactivated.", terminal_id: terminalId, branch_id: current.rows[0].branch_id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

export async function listTerminalBranchHistory(req, res, next) {
  try {
    const terminalId = positiveId(req.params.id, "Terminal ID");
    const result = await pool.query(
      `SELECT tba.id, tba.terminal_id, tba.branch_id, b.name AS branch_name,
              tba.active_from, tba.active_to
       FROM terminal_branch_assignments tba
       JOIN branches b ON b.id = tba.branch_id
       WHERE tba.terminal_id = $1
       ORDER BY tba.active_from DESC, tba.id DESC`,
      [terminalId]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function listTillTerminals(req, res, next) {
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const result = await pool.query(
      `SELECT tt.id, tt.till_id, tt.terminal_id, tt.active_from, tt.active_to,
              t.name AS terminal_name, t.outlet_id, t.account_number,
              t.status AS terminal_status,
              sp.id AS service_provider_id, sp.name AS service_provider_name
       FROM till_terminals tt
       JOIN terminals t ON t.id = tt.terminal_id
       JOIN service_providers sp ON sp.id = t.service_provider_id
       WHERE tt.till_id = $1
       ORDER BY (tt.active_to IS NULL) DESC, tt.sort_order ASC, tt.active_from DESC, sp.name, t.name`,
      [tillId]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function assignTerminalToTill(req, res, next) {
  const client = await pool.connect();
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const terminalId = positiveId(req.body.terminalId, "Terminal ID");
    await client.query("BEGIN");

    const till = await client.query("SELECT id, branch_id FROM tills WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE", [tillId]);
    if (till.rowCount === 0) { const error = new Error("Active Till not found."); error.statusCode = 400; throw error; }

    const terminal = await client.query(
      `SELECT t.id, t.status, tba.branch_id
       FROM terminals t
       LEFT JOIN terminal_branch_assignments tba
         ON tba.terminal_id = t.id AND tba.active_to IS NULL
       WHERE t.id = $1
       FOR UPDATE OF t`,
      [terminalId]
    );
    if (terminal.rowCount === 0 || terminal.rows[0].status !== "ACTIVE") { const error = new Error("Active terminal not found."); error.statusCode = 400; throw error; }
    if (!terminal.rows[0].branch_id) { const error = new Error("Terminal must be assigned to a branch before it can be assigned to a Till."); error.statusCode = 400; throw error; }
    if (Number(terminal.rows[0].branch_id) !== Number(till.rows[0].branch_id)) {
      const error = new Error("Terminal and Till must belong to the same branch.");
      error.statusCode = 400;
      throw error;
    }

    const existing = await client.query(
      `SELECT id FROM till_terminals WHERE till_id = $1 AND terminal_id = $2 AND active_to IS NULL FOR UPDATE`,
      [tillId, terminalId]
    );
    if (existing.rowCount > 0) {
      await client.query("COMMIT");
      return res.json({ message: "Terminal is already actively assigned to this Till.", id: existing.rows[0].id });
    }

    const result = await client.query(
      `INSERT INTO till_terminals (till_id, terminal_id, active_from, sort_order)
       VALUES ($1, $2, NOW(), COALESCE((SELECT MAX(sort_order) + 1 FROM till_terminals WHERE till_id = $1), 0))
       RETURNING id, till_id, terminal_id, active_from, active_to, sort_order`,
      [tillId, terminalId]
    );
    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

export async function unassignTerminalFromTill(req, res, next) {
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const terminalId = positiveId(req.params.terminalId, "Terminal ID");
    const result = await pool.query(
      `UPDATE till_terminals SET active_to = NOW()
       WHERE till_id = $1 AND terminal_id = $2 AND active_to IS NULL
       RETURNING id, till_id, terminal_id, active_from, active_to`,
      [tillId, terminalId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Active Till-terminal assignment not found." });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function reorderTillTerminals(req, res, next) {
  const client = await pool.connect();
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const terminalIds = Array.isArray(req.body.terminalIds) ? req.body.terminalIds.map((id) => positiveId(id, "Terminal ID")) : [];
    if (!terminalIds.length) { const error = new Error("At least one terminal ID is required."); error.statusCode = 400; throw error; }
    if (new Set(terminalIds).size !== terminalIds.length) { const error = new Error("Terminal IDs must be unique."); error.statusCode = 400; throw error; }
    await client.query("BEGIN");
    const active = await client.query(
      `SELECT terminal_id FROM till_terminals
       WHERE till_id = $1 AND active_to IS NULL
       ORDER BY sort_order, id
       FOR UPDATE`, [tillId]
    );
    const activeIds = active.rows.map((row) => Number(row.terminal_id));
    if (activeIds.length !== terminalIds.length || activeIds.some((id) => !terminalIds.includes(id))) {
      const error = new Error("The supplied order must contain exactly all active terminals assigned to this Till.");
      error.statusCode = 400;
      throw error;
    }
    for (let index = 0; index < terminalIds.length; index += 1) {
      await client.query(
        `UPDATE till_terminals SET sort_order = $1 WHERE till_id = $2 AND terminal_id = $3 AND active_to IS NULL`,
        [index, tillId, terminalIds[index]]
      );
    }
    await client.query("COMMIT");
    res.json({ message: "Till terminal order updated successfully." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

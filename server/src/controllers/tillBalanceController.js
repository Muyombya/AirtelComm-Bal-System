import { pool } from "../config/database.js";

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${label} must be a valid ID.`);
    error.statusCode = 400;
    throw error;
  }
  return id;
}

function money(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${label} must be a non-negative number.`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function quantity(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) {
    const error = new Error(`${label} must be a non-negative whole number.`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

const NOTE_DENOMINATIONS = new Set([50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]);
const COIN_DENOMINATIONS = new Set([1000, 500, 200, 100]);


export async function getTillBalancingContext(req, res, next) {
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const businessDate = String(req.query.businessDate || "").trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      const error = new Error("Business date must use YYYY-MM-DD format.");
      error.statusCode = 400;
      throw error;
    }

    const tillResult = await pool.query(
      `SELECT t.id, t.name, t.operating_capital, t.status,
              b.id AS branch_id, b.name AS branch_name
       FROM tills t
       JOIN branches b ON b.id = t.branch_id
       WHERE t.id = $1`,
      [tillId]
    );
    if (tillResult.rowCount === 0) return res.status(404).json({ error: "Till not found." });

    const employeeResult = await pool.query(
      `SELECT e.id, e.name, e.contact
       FROM till_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       WHERE ta.till_id = $1
         AND ta.started_at <= NOW()
         AND (ta.ended_at IS NULL OR ta.ended_at > NOW())
       ORDER BY ta.started_at DESC
       LIMIT 1`,
      [tillId]
    );

    const terminalsResult = await pool.query(
      `SELECT tt.id AS assignment_id,
              t.id AS terminal_id,
              t.name AS terminal_name,
              t.outlet_id,
              t.account_number,
              sp.id AS service_provider_id,
              sp.name AS service_provider_name,
              tt.sort_order
       FROM till_terminals tt
       JOIN terminals t ON t.id = tt.terminal_id
       JOIN service_providers sp ON sp.id = t.service_provider_id
       WHERE tt.till_id = $1
         AND tt.active_from <= NOW()
         AND tt.active_to IS NULL
         AND t.status = 'ACTIVE'
         AND sp.status = 'ACTIVE'
       ORDER BY tt.sort_order ASC, tt.id ASC`,
      [tillId]
    );

    const transactionResult = await pool.query(
      `SELECT ttc.terminal_id, t.name AS terminal_name,
              ttc.transaction_count
       FROM till_transaction_counts ttc
       JOIN terminals t ON t.id = ttc.terminal_id
       WHERE ttc.till_id=$1 AND ttc.business_date=$2
         AND ttc.terminal_id IS NOT NULL`,
      [tillId, businessDate]
    );
    const transactionMap = Object.fromEntries(
      transactionResult.rows.map((row) => [String(row.terminal_id), Number(row.transaction_count)])
    );

    res.json({
      till: tillResult.rows[0],
      attendant: employeeResult.rows[0] || null,
      terminals: terminalsResult.rows,
      dailyTransactions: terminalsResult.rows.map((terminal) => ({
        terminal_id: terminal.terminal_id,
        terminal_name: terminal.terminal_name,
        transactionCount: transactionMap[String(terminal.terminal_id)] || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createTillBalance(req, res, next) {
  const client = await pool.connect();
  try {
    const tillId = positiveId(req.body.tillId, "Till ID");
    const businessDate = String(req.body.businessDate || "").trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      const error = new Error("Business date must use YYYY-MM-DD format.");
      error.statusCode = 400;
      throw error;
    }

    const cashItems = Array.isArray(req.body.cashItems) ? req.body.cashItems : [];
    const floatBalances = Array.isArray(req.body.floatBalances) ? req.body.floatBalances : [];
    const transactionCounts = Array.isArray(req.body.transactionCounts) ? req.body.transactionCounts : [];

    await client.query("BEGIN");

    const tillResult = await client.query(
      `SELECT id, operating_capital, status
       FROM tills
       WHERE id = $1
       FOR UPDATE`,
      [tillId]
    );
    if (tillResult.rowCount === 0) {
      const error = new Error("Till not found."); error.statusCode = 404; throw error;
    }
    const till = tillResult.rows[0];
    if (till.status !== "ACTIVE") {
      const error = new Error("Only an active Till can be balanced."); error.statusCode = 400; throw error;
    }

    const employeeResult = await client.query(
      `SELECT e.id, e.name
       FROM till_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       WHERE ta.till_id = $1
         AND ta.started_at <= NOW()
         AND (ta.ended_at IS NULL OR ta.ended_at > NOW())
       ORDER BY ta.started_at DESC
       LIMIT 1`,
      [tillId]
    );
    if (employeeResult.rowCount === 0) {
      const error = new Error("No active employee is assigned to this Till."); error.statusCode = 400; throw error;
    }
    const employee = employeeResult.rows[0];

    let totalCash = 0;
    const normalizedCash = [];
    for (const item of cashItems) {
      const itemType = String(item.itemType || "").trim().toUpperCase();
      if (itemType === "DENOMINATION") {
        const denomination = money(item.denomination, "Denomination");
        if (!NOTE_DENOMINATIONS.has(denomination)) {
          const error = new Error(`Unsupported note denomination: ${denomination}.`); error.statusCode = 400; throw error;
        }
        const qty = quantity(item.quantity, `Quantity for ${denomination}`);
        const amount = denomination * qty;
        totalCash += amount;
        normalizedCash.push({ itemType, denomination, quantity: qty, amount });
      } else if (itemType === "COINS") {
        const denomination = money(item.denomination, "Coin denomination");
        if (!COIN_DENOMINATIONS.has(denomination)) {
          const error = new Error(`Unsupported coin denomination: ${denomination}.`); error.statusCode = 400; throw error;
        }
        const qty = quantity(item.quantity, `Quantity for coin ${denomination}`);
        const amount = denomination * qty;
        totalCash += amount;
        normalizedCash.push({ itemType, denomination, quantity: qty, amount });
      } else if (itemType === "BATCH") {
        const amount = money(item.amount, "BATCH amount");
        totalCash += amount;
        normalizedCash.push({ itemType, denomination: null, quantity: null, amount });
      } else if (itemType) {
        const error = new Error(`Unsupported cash item type: ${itemType}.`); error.statusCode = 400; throw error;
      }
    }

    const activeTerminalResult = await client.query(
      `SELECT tt.terminal_id, t.name AS terminal_name, sp.id AS service_provider_id, sp.name AS service_provider_name
       FROM till_terminals tt
       JOIN terminals t ON t.id = tt.terminal_id
       JOIN service_providers sp ON sp.id = t.service_provider_id
       WHERE tt.till_id = $1
         AND tt.active_from <= NOW()
         AND tt.active_to IS NULL
         AND t.status = 'ACTIVE'
         AND sp.status = 'ACTIVE'`,
      [tillId]
    );
    const activeTerminalIds = new Set(activeTerminalResult.rows.map((row) => String(row.terminal_id)));

    let totalFloat = 0;
    const normalizedFloats = [];
    for (const item of floatBalances) {
      const terminalId = positiveId(item.terminalId, "Terminal ID");
      if (!activeTerminalIds.has(String(terminalId))) {
        const error = new Error(`Terminal ${terminalId} is not an active float position assigned to this Till.`);
        error.statusCode = 400;
        throw error;
      }
      const amount = money(item.amount, `Float amount for terminal ${terminalId}`);
      totalFloat += amount;
      normalizedFloats.push({ terminalId, amount });
    }

    const operatingCapital = Number(till.operating_capital || 0);
    const actualTillCapital = totalCash + totalFloat;
    const difference = actualTillCapital - operatingCapital;
    const status = difference < 0 ? "SHORT" : difference > 0 ? "EXCESS" : "BALANCED";

    const balanceResult = await client.query(
      `INSERT INTO till_balances
       (till_id, employee_id, business_date, balanced_at, operating_capital,
        total_cash, total_float, actual_till_capital, difference, status)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
       RETURNING id, till_id, employee_id, business_date, balanced_at,
                 operating_capital, total_cash, total_float,
                 actual_till_capital, difference, status`,
      [tillId, employee.id, businessDate, operatingCapital, totalCash, totalFloat, actualTillCapital, difference, status]
    );
    const balance = balanceResult.rows[0];

    for (const item of normalizedCash) {
      await client.query(
        `INSERT INTO cash_count_items (till_balance_id, item_type, denomination, quantity, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [balance.id, item.itemType, item.denomination, item.quantity, item.amount]
      );
    }

    for (const item of normalizedFloats) {
      const terminal = activeTerminalResult.rows.find((row) => String(row.terminal_id) === String(item.terminalId));
      await client.query(
        `INSERT INTO float_balances (till_balance_id, terminal_id, service_provider_id, amount)
         VALUES ($1, $2, $3, $4)`,
        [balance.id, item.terminalId, terminal.service_provider_id, item.amount]
      );
    }

    const assignedTerminalIds = new Set(activeTerminalResult.rows.map((row) => String(row.terminal_id)));
    for (const item of transactionCounts) {
      const terminalId = positiveId(item.terminalId, "Terminal ID");
      if (!assignedTerminalIds.has(String(terminalId))) {
        const error = new Error(`Terminal ${terminalId} is not an active terminal assigned to this Till.`);
        error.statusCode = 400;
        throw error;
      }
      const terminal = activeTerminalResult.rows.find((row) => String(row.terminal_id) === String(terminalId));
      const value = quantity(item.transactionCount, `Transaction count for ${terminal?.terminal_name || terminalId}`);
      await client.query(
        `INSERT INTO till_transaction_counts
           (till_id,business_date,terminal_id,service_key,transaction_count,updated_at)
         VALUES ($1,$2,$3,NULL,$4,NOW())
         ON CONFLICT (till_id,business_date,terminal_id)
         DO UPDATE SET transaction_count=EXCLUDED.transaction_count,updated_at=NOW()`,
        [tillId, businessDate, terminalId, value]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...balance, attendant_name: employee.name });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}

export async function listTillBalances(req, res, next) {
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const result = await pool.query(
      `SELECT tb.id, tb.till_id, tb.employee_id, e.name AS employee_name,
              tb.business_date, tb.balanced_at, tb.operating_capital,
              tb.total_cash, tb.total_float, tb.actual_till_capital,
              tb.difference, tb.status
       FROM till_balances tb
       JOIN employees e ON e.id = tb.employee_id
       WHERE tb.till_id = $1
       ORDER BY tb.balanced_at DESC, tb.id DESC`,
      [tillId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTillBalanceDetails(req, res, next) {
  try {
    const balanceId = positiveId(req.params.balanceId, "Balance ID");
    const balanceResult = await pool.query(
      `SELECT tb.id, tb.till_id, t.name AS till_name, tb.employee_id, e.name AS employee_name,
              tb.business_date, tb.balanced_at, tb.operating_capital,
              tb.total_cash, tb.total_float, tb.actual_till_capital,
              tb.difference, tb.status
       FROM till_balances tb
       JOIN tills t ON t.id = tb.till_id
       JOIN employees e ON e.id = tb.employee_id
       WHERE tb.id = $1`,
      [balanceId]
    );
    if (balanceResult.rowCount === 0) return res.status(404).json({ error: "Balance record not found." });

    const cashResult = await pool.query(
      `SELECT id, item_type, denomination, quantity, amount
       FROM cash_count_items
       WHERE till_balance_id = $1
       ORDER BY CASE item_type WHEN 'DENOMINATION' THEN 1 WHEN 'BATCH' THEN 2 WHEN 'COINS' THEN 3 ELSE 4 END,
                denomination DESC NULLS LAST, id`,
      [balanceId]
    );
    const floatResult = await pool.query(
      `SELECT fb.id, fb.terminal_id, t.name AS terminal_name,
              sp.id AS service_provider_id, sp.name AS service_provider_name,
              fb.amount
       FROM float_balances fb
       JOIN terminals t ON t.id = fb.terminal_id
       JOIN service_providers sp ON sp.id = fb.service_provider_id
       WHERE fb.till_balance_id = $1
       ORDER BY sp.name, t.name, fb.id`,
      [balanceId]
    );

    res.json({ balance: balanceResult.rows[0], cashItems: cashResult.rows, floatBalances: floatResult.rows });
  } catch (error) {
    next(error);
  }
}

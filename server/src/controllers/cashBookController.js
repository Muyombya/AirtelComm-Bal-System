import { pool } from "../config/database.js";

function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error(`${label} must be a valid ID.`); e.statusCode = 400; throw e;
  }
  return id;
}
function validDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const e = new Error("Business date must use YYYY-MM-DD format."); e.statusCode = 400; throw e;
  }
  return date;
}
function positiveAmount(value) {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    const e = new Error("Amount must be greater than zero."); e.statusCode = 400; throw e;
  }
  return amount;
}
async function ensureBranch(client, branchId) {
  const result = await client.query(`SELECT id, name FROM branches WHERE id=$1`, [branchId]);
  if (!result.rowCount) { const e = new Error("Branch not found."); e.statusCode = 404; throw e; }
  return result.rows[0];
}

export async function getCashBook(req, res, next) {
  try {
    const branchId = positiveId(req.query.branchId || 1, "Branch ID");
    const date = validDate(req.query.businessDate || new Date().toISOString().slice(0, 10));
    const branch = await pool.query(`SELECT id,name FROM branches WHERE id=$1`, [branchId]);
    if (!branch.rowCount) return res.status(404).json({ error: "Branch not found." });
    const account = await pool.query(`SELECT id, opening_balance, opening_set_at FROM cash_book_accounts WHERE branch_id=$1`, [branchId]);
    const entries = await pool.query(
      `SELECT cbe.id, cbe.entry_type, cbe.amount, cbe.category, cbe.description, cbe.reference,
              cbe.business_date, cbe.entered_at, cbe.created_by, cbe.expense_scope, e.name AS created_by_name
       FROM cash_book_entries cbe LEFT JOIN employees e ON e.id=cbe.created_by
       WHERE cbe.branch_id=$1 AND cbe.business_date=$2
       ORDER BY cbe.entered_at ASC, cbe.id ASC`, [branchId, date]);
    const openingBalance = Number(account.rows[0]?.opening_balance || 0);
    const allEntries = await pool.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE entry_type='TOP_UP'),0)::NUMERIC(18,2) AS total_top_ups,
              COALESCE(SUM(amount) FILTER (WHERE entry_type='EXPENSE'),0)::NUMERIC(18,2) AS total_expenses
       FROM cash_book_entries WHERE branch_id=$1 AND business_date <= $2`, [branchId, date]);
    const totalTopUps = Number(allEntries.rows[0]?.total_top_ups || 0);
    const totalExpenses = Number(allEntries.rows[0]?.total_expenses || 0);
    const closingBalance = openingBalance + totalTopUps - totalExpenses;
    const daily = entries.rows.reduce((summary, row) => {
      const amount = Number(row.amount || 0);
      if (row.entry_type === "TOP_UP") summary.topUps += amount;
      if (row.entry_type === "EXPENSE") summary.expenses += amount;
      return summary;
    }, { topUps: 0, expenses: 0 });
    res.json({ branch: branch.rows[0], businessDate: date, openingBalance, openingSetAt: account.rows[0]?.opening_set_at || null,
      daily: { topUps: daily.topUps, expenses: daily.expenses, netMovement: daily.topUps - daily.expenses },
      totals: { topUps: totalTopUps, expenses: totalExpenses, closingBalance },
      entries: entries.rows.map(row => ({ ...row, id: Number(row.id), amount: Number(row.amount) })) });
  } catch (e) { next(e); }
}

export async function setCashBookOpeningBalance(req, res, next) {
  const client = await pool.connect();
  try {
    const branchId = positiveId(req.body.branchId || 1, "Branch ID");
    const openingBalance = Number(String(req.body.openingBalance ?? "").replace(/,/g, ""));
    if (!Number.isFinite(openingBalance) || openingBalance < 0) { const e = new Error("Opening Balance must be zero or greater."); e.statusCode = 400; throw e; }
    await client.query("BEGIN"); await ensureBranch(client, branchId);
    const existingEntries = await client.query(`SELECT COUNT(*)::INT AS count FROM cash_book_entries WHERE branch_id=$1`, [branchId]);
    if (existingEntries.rows[0].count > 0) { const e = new Error("Opening Balance cannot be changed after Cash Book transactions have been recorded."); e.statusCode = 409; throw e; }
    await client.query(`INSERT INTO cash_book_accounts (branch_id, opening_balance, opening_set_at) VALUES ($1,$2,NOW())
      ON CONFLICT (branch_id) DO UPDATE SET opening_balance=EXCLUDED.opening_balance, opening_set_at=NOW()`, [branchId, openingBalance]);
    await client.query("COMMIT"); res.json({ message: "Cash Book Opening Balance saved successfully." });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); } finally { client.release(); }
}

export async function createCashBookEntry(req, res, next) {
  const client = await pool.connect();
  try {
    const entryType = String(req.body.entryType || "").trim().toUpperCase();
    if (!["TOP_UP", "EXPENSE"].includes(entryType)) { const e = new Error("Entry Type must be TOP_UP or EXPENSE."); e.statusCode = 400; throw e; }
    const amount = positiveAmount(req.body.amount);
    const date = validDate(req.body.businessDate || new Date().toISOString().slice(0, 10));
    const description = String(req.body.description ?? "").trim() || null;
    const category = String(req.body.category || "").trim() || null;
    const reference = String(req.body.reference || "").trim() || null;
    const expenseScope = String(req.body.expenseScope || (entryType === "EXPENSE" ? "BRANCH" : "BRANCH")).trim().toUpperCase();
    if (req.user?.role === "SUPERVISOR" && expenseScope === "COMPANY") {
      const e = new Error("Supervisors can only record expenses for their assigned branch.");
      e.statusCode = 403;
      throw e;
    }
    if (!['BRANCH','COMPANY'].includes(expenseScope)) { const e = new Error("Expense Scope must be Branch or Company."); e.statusCode = 400; throw e; }
    if (entryType === "TOP_UP" && expenseScope !== "BRANCH") { const e = new Error("Funds Added entries must belong to a branch."); e.statusCode = 400; throw e; }
    if (entryType === "EXPENSE" && !category) { const e = new Error("Expense Category is required."); e.statusCode = 400; throw e; }
    const createdBy = req.body.createdBy ? positiveId(req.body.createdBy, "Created By") : null;
    const branchId = req.body.branchId === null || req.body.branchId === "" || req.body.branchId === undefined ? null : positiveId(req.body.branchId, "Branch ID");
    if (entryType === "EXPENSE" && expenseScope === "BRANCH" && !branchId) { const e = new Error("Select a branch for a Branch expense."); e.statusCode = 400; throw e; }
    if (entryType === "EXPENSE" && expenseScope === "COMPANY" && branchId !== null) { const e = new Error("Company expenses must not be assigned to a branch."); e.statusCode = 400; throw e; }
    if (entryType === "TOP_UP" && !branchId) { const e = new Error("Select a branch for Funds Added."); e.statusCode = 400; throw e; }

    await client.query("BEGIN");
    if (branchId) await ensureBranch(client, branchId);

    if (entryType === "EXPENSE" && expenseScope === "BRANCH") {
      const account = await client.query(`SELECT opening_balance, opening_set_at FROM cash_book_accounts WHERE branch_id=$1 FOR UPDATE`, [branchId]);
      if (!account.rowCount || !account.rows[0].opening_set_at) { const e = new Error("Set the Cash Book Opening Balance before recording transactions."); e.statusCode = 409; throw e; }
      const position = await client.query(`SELECT (cba.opening_balance + COALESCE(SUM(CASE WHEN cbe.entry_type='TOP_UP' THEN cbe.amount ELSE -cbe.amount END),0))::NUMERIC(18,2) AS balance
        FROM cash_book_accounts cba LEFT JOIN cash_book_entries cbe ON cbe.branch_id=cba.branch_id
        WHERE cba.branch_id=$1 GROUP BY cba.opening_balance`, [branchId]);
      const available = Number(position.rows[0]?.balance || 0);
      if (amount > available) { const e = new Error(`Expense cannot exceed the available Cash Book balance of UGX ${available.toLocaleString("en-UG")}.`); e.statusCode = 409; throw e; }
    }

    const inserted = await client.query(`INSERT INTO cash_book_entries
      (branch_id,entry_type,amount,category,description,reference,business_date,created_by,expense_scope)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id,branch_id,entry_type,amount,category,description,reference,business_date,entered_at,created_by,expense_scope`,
      [branchId,entryType,amount,category,description,reference,date,createdBy,expenseScope]);
    await client.query("COMMIT");
    res.status(201).json({ message: entryType === "EXPENSE" ? "Expense recorded successfully." : "Cash Book funds added successfully.",
      entry: { ...inserted.rows[0], id: Number(inserted.rows[0].id), branch_id: inserted.rows[0].branch_id === null ? null : Number(inserted.rows[0].branch_id), amount: Number(inserted.rows[0].amount) } });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); } finally { client.release(); }
}

export async function getCashBookHistory(req, res, next) {
  try {
    const scope = req.user?.role === "SUPERVISOR"
      ? String(req.user.branch_id)
      : String(req.query.branchId ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    let result;
    if (scope === "company") {
      result = await pool.query(`SELECT cbe.id,cbe.branch_id,cbe.entry_type,cbe.amount,cbe.category,cbe.description,cbe.reference,
        cbe.business_date,cbe.entered_at,cbe.expense_scope,e.name AS created_by_name
        FROM cash_book_entries cbe LEFT JOIN employees e ON e.id=cbe.created_by
        WHERE cbe.expense_scope='COMPANY'
        ORDER BY cbe.business_date DESC,cbe.entered_at DESC,cbe.id DESC LIMIT $1`, [limit]);
    } else {
      const branchId = positiveId(req.query.branchId || 1, "Branch ID");
      result = await pool.query(`SELECT cbe.id,cbe.branch_id,cbe.entry_type,cbe.amount,cbe.category,cbe.description,cbe.reference,
        cbe.business_date,cbe.entered_at,cbe.expense_scope,e.name AS created_by_name
        FROM cash_book_entries cbe LEFT JOIN employees e ON e.id=cbe.created_by WHERE cbe.branch_id=$1
        ORDER BY cbe.business_date DESC,cbe.entered_at DESC,cbe.id DESC LIMIT $2`, [branchId, limit]);
    }
    res.json(result.rows.map(row => ({ ...row, id:Number(row.id), branch_id:row.branch_id===null?null:Number(row.branch_id), amount:Number(row.amount) })));
  } catch (e) { next(e); }
}

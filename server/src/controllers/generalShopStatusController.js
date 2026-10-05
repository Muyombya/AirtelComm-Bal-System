import { pool } from "../config/database.js";



function positiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error(`${label} must be a valid ID.`);
    e.statusCode = 400;
    throw e;
  }
  return id;
}

function businessDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const e = new Error("Business date must use YYYY-MM-DD format.");
    e.statusCode = 400;
    throw e;
  }
  return date;
}

function count(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    const e = new Error(`${label} must be a non-negative whole number.`);
    e.statusCode = 400;
    throw e;
  }
  return n;
}

function amount(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    const e = new Error(`${label} must be greater than zero.`);
    e.statusCode = 400;
    throw e;
  }
  return n;
}

export async function saveTillTransactionCounts(req, res, next) {
  const client = await pool.connect();
  try {
    const tillId = positiveId(req.body.tillId, "Till ID");
    const date = businessDate(req.body.businessDate);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    await client.query("BEGIN");
    const till = await client.query(`SELECT id, status FROM tills WHERE id=$1`, [tillId]);
    if (!till.rowCount) { const e = new Error("Till not found."); e.statusCode = 404; throw e; }
    if (till.rows[0].status !== "ACTIVE") { const e = new Error("Only an active Till can record transaction counts."); e.statusCode = 400; throw e; }

    const activeTerminals = await client.query(
      `SELECT tt.terminal_id, term.name AS terminal_name
       FROM till_terminals tt JOIN terminals term ON term.id=tt.terminal_id
       WHERE tt.till_id=$1 AND tt.active_from <= NOW() AND tt.active_to IS NULL AND term.status='ACTIVE'`, [tillId]
    );
    const allowed = new Map(activeTerminals.rows.map(r => [String(r.terminal_id), r.terminal_name]));

    for (const item of items) {
      const terminalId = positiveId(item.terminalId, "Terminal ID");
      if (!allowed.has(String(terminalId))) { const e = new Error(`Terminal ${terminalId} is not an active terminal assigned to this Till.`); e.statusCode = 400; throw e; }
      const value = count(item.transactionCount, allowed.get(String(terminalId)));
      await client.query(
        `INSERT INTO till_transaction_counts (till_id,business_date,terminal_id,service_key,transaction_count,updated_at)
         VALUES ($1,$2,$3,NULL,$4,NOW())
         ON CONFLICT (till_id,business_date,terminal_id)
         DO UPDATE SET transaction_count=EXCLUDED.transaction_count, updated_at=NOW()`,
        [tillId, date, terminalId, value]
      );
    }
    await client.query("COMMIT");
    res.json({ message: "Till daily transaction counts saved successfully." });
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); }
  finally { client.release(); }
}

export async function getTillTransactionCounts(req, res, next) {
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const date = businessDate(req.query.businessDate);
    const result = await pool.query(
      `SELECT ttc.terminal_id, term.name AS terminal_name, ttc.transaction_count
       FROM till_transaction_counts ttc
       JOIN terminals term ON term.id=ttc.terminal_id
       WHERE ttc.till_id=$1 AND ttc.business_date=$2 AND ttc.terminal_id IS NOT NULL
       ORDER BY term.name`, [tillId, date]
    );
    res.json(result.rows.map(r => ({ terminal_id:r.terminal_id, terminal_name:r.terminal_name, transactionCount:Number(r.transaction_count||0) })));
  } catch (e) { next(e); }
}

async function getShortageSummary(client, branchId, date) {
  const result = await client.query(
    `WITH shortage_events AS (
       SELECT p.till_balance_id,
              p.employee_id,
              p.employee_name,
              p.till_name,
              p.business_date,
              p.shortage,
              COALESCE(SUM(a.amount) FILTER (WHERE bsp.payment_date <= $2),0)::NUMERIC(18,2) AS recovered
       FROM till_shortage_event_positions p
       LEFT JOIN till_shortage_settlement_allocations a
         ON a.till_balance_id=p.till_balance_id
       LEFT JOIN branch_shortage_payments bsp
         ON bsp.id=a.payment_id
       WHERE p.branch_id=$1
         AND p.business_date <= $2
       GROUP BY p.till_balance_id,p.employee_id,p.employee_name,p.till_name,p.business_date,p.shortage
     ),
     people AS (
       SELECT employee_id FROM shortage_events
       UNION
       SELECT employee_id FROM branch_shortage_payments
       WHERE branch_id=$1 AND payment_date <= $2
     ),
     shortage_totals AS (
       SELECT employee_id,
              STRING_AGG(DISTINCT till_name, ', ' ORDER BY till_name) AS till_names,
              COALESCE(SUM(shortage),0)::NUMERIC(18,2) AS total_incurred,
              COALESCE(SUM(shortage) FILTER (WHERE business_date = $2),0)::NUMERIC(18,2) AS new_shortage,
              COALESCE(SUM(recovered),0)::NUMERIC(18,2) AS recovered_to_date
       FROM shortage_events
       GROUP BY employee_id
     ),
     payments AS (
       SELECT employee_id,
              COALESCE(SUM(amount) FILTER (WHERE payment_date < $2),0)::NUMERIC(18,2) AS payments_before,
              COALESCE(SUM(amount) FILTER (WHERE payment_date = $2),0)::NUMERIC(18,2) AS payments_today,
              COALESCE(SUM(amount),0)::NUMERIC(18,2) AS payments_to_date
       FROM branch_shortage_payments
       WHERE branch_id=$1 AND payment_date <= $2
       GROUP BY employee_id
     )
     SELECT p.employee_id,
            e.name AS employee_name,
            COALESCE(st.till_names,'') AS till_names,
            COALESCE(st.total_incurred,0)::NUMERIC(18,2) AS total_incurred,
            COALESCE(st.new_shortage,0)::NUMERIC(18,2) AS new_shortage,
            COALESCE(st.recovered_to_date,0)::NUMERIC(18,2) AS recovered_to_date,
            COALESCE(pt.payments_before,0)::NUMERIC(18,2) AS payments_before,
            COALESCE(pt.payments_today,0)::NUMERIC(18,2) AS payments_today,
            GREATEST(COALESCE(st.total_incurred,0)-COALESCE(st.recovered_to_date,0),0)::NUMERIC(18,2) AS balance
     FROM people p
     JOIN employees e ON e.id=p.employee_id
     LEFT JOIN shortage_totals st ON st.employee_id=p.employee_id
     LEFT JOIN payments pt ON pt.employee_id=p.employee_id
     WHERE GREATEST(COALESCE(st.total_incurred,0)-COALESCE(st.recovered_to_date,0),0) > 0
        OR COALESCE(st.new_shortage,0) > 0
        OR COALESCE(pt.payments_today,0) > 0
     ORDER BY e.name`,
    [branchId, date]
  );

  return result.rows.map(r => ({
    employeeId: Number(r.employee_id),
    name: r.employee_name,
    tillName: r.till_names || "—",
    totalIncurred: Number(r.total_incurred || 0),
    newShortage: Number(r.new_shortage || 0),
    recoveredToDate: Number(r.recovered_to_date || 0),
    paymentsBefore: Number(r.payments_before || 0),
    paymentsToday: Number(r.payments_today || 0),
    balance: Number(r.balance || 0),
  }));
}

export async function getGeneralShopStatus(req, res, next) {
  try {
    const branchId = positiveId(req.query.branchId || 1, "Branch ID");
    const date = businessDate(req.query.businessDate || new Date().toISOString().slice(0, 10));

    const branch = await pool.query(`SELECT id,name,operating_capital FROM branches WHERE id=$1`, [branchId]);
    if (!branch.rowCount) return res.status(404).json({ error: "Branch not found." });

    const tills = await pool.query(
      `SELECT id,name,operating_capital,status FROM tills WHERE branch_id=$1 ORDER BY id`, [branchId]
    );

    const balances = await pool.query(
      `SELECT DISTINCT ON (tb.till_id)
          tb.id,tb.till_id,tb.employee_id,t.name AS till_name,e.name AS attendant_name,
          tb.business_date,tb.balanced_at,tb.operating_capital,
          tb.total_cash,tb.total_float,tb.actual_till_capital,tb.difference,tb.status
       FROM till_balances tb
       JOIN tills t ON t.id=tb.till_id JOIN employees e ON e.id=tb.employee_id
       WHERE t.branch_id=$1 AND tb.business_date=$2
       ORDER BY tb.till_id,tb.balanced_at DESC,tb.id DESC`, [branchId,date]
    );

    const positions = await pool.query(
      `SELECT x.terminal_name, SUM(x.amount)::NUMERIC(18,2) AS amount
       FROM (
         SELECT DISTINCT ON (fb.terminal_id,tb.till_id)
           fb.terminal_id,tb.till_id,t.name AS terminal_name,fb.amount,tb.balanced_at,tb.id
         FROM float_balances fb
         JOIN till_balances tb ON tb.id=fb.till_balance_id
         JOIN tills ti ON ti.id=tb.till_id JOIN terminals t ON t.id=fb.terminal_id
         WHERE ti.branch_id=$1 AND tb.business_date=$2
         ORDER BY fb.terminal_id,tb.till_id,tb.balanced_at DESC,tb.id DESC
       ) x GROUP BY x.terminal_name ORDER BY x.terminal_name`, [branchId,date]
    );

    const tx = await pool.query(
      `SELECT ttc.terminal_id, MAX(term.name) AS terminal_name,
              SUM(ttc.transaction_count)::INT AS transaction_count
       FROM till_transaction_counts ttc
       JOIN tills t ON t.id=ttc.till_id
       JOIN terminals term ON term.id=ttc.terminal_id
       WHERE t.branch_id=$1 AND ttc.business_date=$2 AND ttc.terminal_id IS NOT NULL
       GROUP BY ttc.terminal_id
       ORDER BY terminal_name`, [branchId,date]
    );

    const entry = await pool.query(
      `SELECT accessories_count, reason FROM general_shop_status_entries WHERE branch_id=$1 AND business_date=$2`, [branchId,date]
    );

    const shortageRows = await getShortageSummary(pool, branchId, date);
    const shortagePayments = await pool.query(
      `SELECT bsp.id, bsp.till_id, t.name AS till_name, bsp.employee_id, e.name AS employee_name, bsp.amount, bsp.payment_date, bsp.note, bsp.created_at
       FROM branch_shortage_payments bsp
       JOIN employees e ON e.id=bsp.employee_id
       LEFT JOIN tills t ON t.id=bsp.till_id
       WHERE bsp.branch_id=$1 AND bsp.payment_date <= $2
       ORDER BY bsp.payment_date DESC, bsp.id DESC
       LIMIT 100`, [branchId,date]
    );
    // Cash Book Position must mirror the Cash Book module exactly.
    // cash_book_accounts.opening_balance is the branch's original/base opening
    // balance. For a selected business date, the opening balance is the prior
    // cumulative closing balance, i.e. base opening + all prior top-ups - all
    // prior expenses. The selected day's movement is then applied to produce
    // the closing balance. This prevents General Shop Status from resetting
    // the Cash Book opening balance to the original account opening each day.
    const cashBookResult = await pool.query(
      `WITH account AS (
         SELECT COALESCE(opening_balance,0)::NUMERIC(18,2) AS base_opening_balance
         FROM cash_book_accounts
         WHERE branch_id=$1
       ),
       prior AS (
         SELECT
           COALESCE(SUM(cbe.amount) FILTER (WHERE cbe.entry_type='TOP_UP'),0)::NUMERIC(18,2) AS prior_top_ups,
           COALESCE(SUM(cbe.amount) FILTER (WHERE cbe.entry_type='EXPENSE'),0)::NUMERIC(18,2) AS prior_expenses
         FROM cash_book_entries cbe
         WHERE cbe.branch_id=$1 AND cbe.business_date < $2
       ),
       selected_day AS (
         SELECT
           COALESCE(SUM(cbe.amount) FILTER (WHERE cbe.entry_type='TOP_UP'),0)::NUMERIC(18,2) AS daily_top_ups,
           COALESCE(SUM(cbe.amount) FILTER (WHERE cbe.entry_type='EXPENSE'),0)::NUMERIC(18,2) AS daily_expenses,
           COUNT(*)::INT AS daily_entries
         FROM cash_book_entries cbe
         WHERE cbe.branch_id=$1 AND cbe.business_date = $2
       ),
       cumulative AS (
         SELECT
           COALESCE(SUM(cbe.amount) FILTER (WHERE cbe.entry_type='TOP_UP'),0)::NUMERIC(18,2) AS total_top_ups,
           COALESCE(SUM(cbe.amount) FILTER (WHERE cbe.entry_type='EXPENSE'),0)::NUMERIC(18,2) AS total_expenses
         FROM cash_book_entries cbe
         WHERE cbe.branch_id=$1 AND cbe.business_date <= $2
       )
       SELECT
         a.base_opening_balance,
         (a.base_opening_balance + p.prior_top_ups - p.prior_expenses)::NUMERIC(18,2) AS opening_balance,
         d.daily_top_ups,
         d.daily_expenses,
         c.total_top_ups,
         c.total_expenses,
         d.daily_entries,
         (a.base_opening_balance + c.total_top_ups - c.total_expenses)::NUMERIC(18,2) AS closing_balance
       FROM account a
       CROSS JOIN prior p
       CROSS JOIN selected_day d
       CROSS JOIN cumulative c`,
      [branchId, date]
    );
    const cashBookExpensesResult = await pool.query(
      `SELECT id, category, description, amount, reference, entered_at
       FROM cash_book_entries
       WHERE branch_id=$1
         AND entry_type='EXPENSE'
         AND business_date=$2
       ORDER BY entered_at ASC, id ASC`,
      [branchId, date]
    );
    const cashBookRow = cashBookResult.rows[0] || {};
    const cashBookOpeningBalance = Number(cashBookRow.opening_balance || 0);
    const cashBookDailyTopUps = Number(cashBookRow.daily_top_ups || 0);
    const cashBookDailyExpenses = Number(cashBookRow.daily_expenses || 0);
    const cashBookTotalTopUps = Number(cashBookRow.total_top_ups || 0);
    const cashBookTotalExpenses = Number(cashBookRow.total_expenses || 0);
    const cashBookClosingBalance = Number(cashBookRow.closing_balance || 0);

    const totalShortageBalance = shortageRows.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalShortageAdded = shortageRows.reduce((s, r) => s + Number(r.newShortage || 0), 0);
    const totalShortagePaid = shortageRows.reduce((s, r) => s + Number(r.paymentsToday || 0), 0);

    const latestByTill = Object.fromEntries(balances.rows.map(r => [r.till_id,r]));

    // Branch Operating Capital is the authoritative branch benchmark from Master Data.
    // Till Operating Capital is only the allocation beneath the branch and must not
    // replace the branch-level capital benchmark in General Shop Status.
    const branchOperatingCapital = Number(branch.rows[0].operating_capital || 0);
    const totalCash = balances.rows.reduce((s,r)=>s+Number(r.total_cash||0),0);
    const totalFloat = balances.rows.reduce((s,r)=>s+Number(r.total_float||0),0);
    const branchCapital = totalCash + totalFloat;
    const difference = branchCapital - branchOperatingCapital;
    const effectiveWorkingCapital = Math.max(branchOperatingCapital - totalShortageBalance, 0);
    const adjustedBranchCapital = branchCapital + totalShortageBalance + totalShortagePaid;
    const adjustedDifference = adjustedBranchCapital - branchOperatingCapital;
    const complete = balances.rows.length === tills.rows.length;
    const status = !complete ? "INCOMPLETE" : difference < 0 ? "SHORT" : difference > 0 ? "EXCESS" : "BALANCED";
    const adjustedStatus = !complete ? "INCOMPLETE" : adjustedDifference < 0 ? "SHORT" : adjustedDifference > 0 ? "EXCESS" : "BALANCED";

    // Every date represented by a General Shop Status source is retrievable.
    // The latest Till balance for each Till on that date is used so multiple
    // balancing events do not create duplicate daily positions.
    const history = await pool.query(
      `WITH history_dates AS (
         SELECT tb.business_date
         FROM till_balances tb
         JOIN tills t ON t.id=tb.till_id
         WHERE t.branch_id=$1
         UNION
         SELECT ttc.business_date
         FROM till_transaction_counts ttc
         JOIN tills t ON t.id=ttc.till_id
         WHERE t.branch_id=$1
         UNION
         SELECT business_date FROM general_shop_status_entries WHERE branch_id=$1
         UNION
         SELECT payment_date AS business_date FROM branch_shortage_payments WHERE branch_id=$1
       ),
       latest AS (
         SELECT DISTINCT ON (tb.till_id,tb.business_date)
           tb.till_id,tb.business_date,tb.operating_capital,
           tb.total_cash,tb.total_float,tb.balanced_at
         FROM till_balances tb
         JOIN tills t ON t.id=tb.till_id
         WHERE t.branch_id=$1
         ORDER BY tb.till_id,tb.business_date,tb.balanced_at DESC,tb.id DESC
       ),
       daily AS (
         SELECT hd.business_date,
                COUNT(l.till_id)::INT AS balanced_tills,
                COALESCE(SUM(l.total_cash),0)::NUMERIC(18,2) AS total_cash,
                COALESCE(SUM(l.total_float),0)::NUMERIC(18,2) AS total_float,
                MAX(l.balanced_at) AS last_balanced_at
         FROM history_dates hd
         LEFT JOIN latest l ON l.business_date=hd.business_date
         GROUP BY hd.business_date
       ),
       daily_capital AS (
         SELECT d.business_date,
                d.balanced_tills,d.total_cash,d.total_float,d.last_balanced_at,
                (SELECT COALESCE(b.operating_capital,0) FROM branches b WHERE b.id=$1)::NUMERIC(18,2) AS operating_capital
         FROM daily d
       )
       SELECT dc.business_date,dc.balanced_tills,$2::INT AS total_tills,
              dc.operating_capital,
              dc.total_cash,dc.total_float,(dc.total_cash+dc.total_float)::NUMERIC(18,2) AS actual_capital,
              (dc.total_cash+dc.total_float-dc.operating_capital)::NUMERIC(18,2) AS difference,
              CASE WHEN dc.balanced_tills < $2 THEN 'INCOMPLETE'
                   WHEN dc.total_cash+dc.total_float-dc.operating_capital < 0 THEN 'SHORT'
                   WHEN dc.total_cash+dc.total_float-dc.operating_capital > 0 THEN 'EXCESS' ELSE 'BALANCED' END AS status,
              dc.last_balanced_at,g.accessories_count,g.reason
       FROM daily_capital dc
       LEFT JOIN general_shop_status_entries g ON g.branch_id=$1 AND g.business_date=dc.business_date
       ORDER BY dc.business_date DESC LIMIT 100`,
      [branchId, tills.rows.length]
    );

    const tillShortagePosition = {};
    for (const row of shortageRows) {
      tillShortagePosition[row.employeeId] = {
        outstanding: Number(row.balance || 0),
        recovered: Number(row.paymentsToday || 0),
      };
    }

    res.json({
      branch: branch.rows[0], businessDate: date,
      tills: tills.rows.map(t=>{
        const b=latestByTill[t.id]||null;
        const shortagePosition=b ? (tillShortagePosition[b.employee_id] || { outstanding: 0, recovered: 0 }) : { outstanding: 0, recovered: 0 };
        const shortageCapital=shortagePosition.outstanding + shortagePosition.recovered;
        return { till:t, balance:b, shortageBalance:shortagePosition.outstanding, shortageRecovered:shortagePosition.recovered,
          adjustedActualCapital:b ? Number(b.actual_till_capital)+shortageCapital : null,
          adjustedDifference:b ? Number(b.difference)+shortageCapital : null };
      }),
      positions: positions.rows.map(r=>({terminal_name:r.terminal_name,amount:Number(r.amount)})),
      dailyTransactions: tx.rows.map(r=>({ terminal_id:r.terminal_id, terminal_name:r.terminal_name, transactionCount:Number(r.transaction_count||0) })),
      accessoriesCount: Number(entry.rows[0]?.accessories_count||0),
      imbalanceRemark: entry.rows[0]?.reason || "",
      reason: entry.rows[0]?.reason || "",
      cashBook: {
        openingBalance: cashBookOpeningBalance,
        dailyTopUps: cashBookDailyTopUps,
        dailyExpenses: cashBookDailyExpenses,
        dailyNetMovement: cashBookDailyTopUps - cashBookDailyExpenses,
        totalTopUps: cashBookTotalTopUps,
        totalExpenses: cashBookTotalExpenses,
        closingBalance: cashBookClosingBalance,
        dailyEntries: Number(cashBookRow.daily_entries || 0),
        expenses: cashBookExpensesResult.rows.map(r => ({
          id: Number(r.id),
          category: r.category || "Other",
          description: r.description || "",
          amount: Number(r.amount || 0),
          reference: r.reference || "",
          enteredAt: r.entered_at,
        })),
      },
      shortageCounter: shortageRows,
      shortagePayments: shortagePayments.rows.map(r => ({ id:Number(r.id), tillId:r.till_id == null ? null : Number(r.till_id), tillName:r.till_name || "", employeeId:Number(r.employee_id), employeeName:r.employee_name, amount:Number(r.amount), paymentDate:r.payment_date, note:r.note || "", createdAt:r.created_at })),
      totals:{branchOperatingCapital,totalCash,totalFloat,branchCapital,difference,totalShortageBalance,totalShortageAdded,totalShortagePaid,effectiveWorkingCapital,adjustedBranchCapital,adjustedDifference,status,adjustedStatus},
      balancedTillCount:balances.rows.length,totalTillCount:tills.rows.length,history:history.rows
    });
  } catch(e){ next(e); }
}

export async function saveGeneralShopStatus(req,res,next) {
  try {
    const branchId=positiveId(req.body.branchId||1,"Branch ID");
    const date=businessDate(req.body.businessDate);
    const accessoriesCount=count(req.body.accessoriesCount||0,"Accessories");
    const reason=String(req.body.reason||"").trim();
    const totals=await pool.query(
      `SELECT
        (SELECT COALESCE(b.operating_capital,0) FROM branches b WHERE b.id=$1) AS operating_capital,
        (SELECT COALESCE(SUM(tb.total_cash),0) FROM till_balances tb JOIN tills t ON t.id=tb.till_id
          WHERE t.branch_id=$1 AND tb.business_date=$2 AND tb.id IN
            (SELECT DISTINCT ON (till_id) id FROM till_balances WHERE business_date=$2 ORDER BY till_id,balanced_at DESC,id DESC)) AS total_cash,
        (SELECT COALESCE(SUM(tb.total_float),0) FROM till_balances tb JOIN tills t ON t.id=tb.till_id
          WHERE t.branch_id=$1 AND tb.business_date=$2 AND tb.id IN
            (SELECT DISTINCT ON (till_id) id FROM till_balances WHERE business_date=$2 ORDER BY till_id,balanced_at DESC,id DESC)) AS total_float`, [branchId,date]
    );
    const operating=Number(totals.rows[0].operating_capital||0);
    const actual=Number(totals.rows[0].total_cash||0)+Number(totals.rows[0].total_float||0);
    const tillCount=await pool.query(`SELECT COUNT(*)::INT AS n FROM tills WHERE branch_id=$1 AND status='ACTIVE'`,[branchId]);
    const balancedCount=await pool.query(`SELECT COUNT(DISTINCT tb.till_id)::INT AS n FROM till_balances tb JOIN tills t ON t.id=tb.till_id WHERE t.branch_id=$1 AND tb.business_date=$2`,[branchId,date]);
    const status=Number(balancedCount.rows[0].n)<Number(tillCount.rows[0].n)?"INCOMPLETE":actual-operating<0?"SHORT":actual-operating>0?"EXCESS":"BALANCED";
    if ((status==="SHORT" || status==="EXCESS") && !reason) { const e=new Error("A brief reason is required when the branch is SHORT or EXCESS."); e.statusCode=400; throw e; }
    await pool.query(`INSERT INTO general_shop_status_entries(branch_id,business_date,accessories_count,reason,updated_at)
      VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(branch_id,business_date)
      DO UPDATE SET accessories_count=EXCLUDED.accessories_count,reason=EXCLUDED.reason,updated_at=NOW()`, [branchId,date,accessoriesCount,reason||null]);
    res.json({message:"General Shop Status saved successfully.",status});
  } catch(e){next(e);}
}

export async function recordShortagePayment(req, res, next) {
  const client = await pool.connect();
  try {
    const branchId = positiveId(req.body.branchId || 1, "Branch ID");
    const employeeId = positiveId(req.body.employeeId, "Employee ID");
    const tillId = positiveId(req.body.tillId, "Till ID");
    const paymentDate = businessDate(req.body.paymentDate || new Date().toISOString().slice(0,10));
    const paymentAmount = amount(req.body.amount, "Payment amount");
    const note = String(req.body.note || "").trim();

    await client.query("BEGIN");
    const employee = await client.query(
      `SELECT e.id,e.name FROM employees e JOIN till_assignments ta ON ta.employee_id=e.id
       JOIN tills t ON t.id=ta.till_id WHERE e.id=$1 AND t.branch_id=$2 AND t.id=$3 LIMIT 1 FOR UPDATE`, [employeeId, branchId, tillId]
    );
    if (!employee.rowCount) { const e=new Error("Employee is not assigned to a Till in this branch."); e.statusCode=404; throw e; }

    const owedResult = await client.query(
      `WITH latest_balances AS (
         SELECT DISTINCT ON (tb.till_id, tb.business_date)
                tb.till_id, tb.business_date, tb.employee_id, tb.difference
         FROM till_balances tb
         JOIN tills t ON t.id=tb.till_id
         WHERE t.branch_id=$1 AND t.id=$4 AND tb.business_date <= $3
         ORDER BY tb.till_id, tb.business_date, tb.balanced_at DESC, tb.id DESC
       )
       SELECT COALESCE(SUM(CASE WHEN difference < 0 THEN -difference ELSE 0 END),0) AS amount_owed
       FROM latest_balances
       WHERE employee_id=$2`, [branchId,employeeId,paymentDate,tillId]
    );
    const paidResult = await client.query(
      `SELECT COALESCE(SUM(amount),0) AS paid_off FROM branch_shortage_payments
       WHERE till_id=$1 AND branch_id=$2 AND employee_id=$3 AND payment_date <= $4`, [tillId,branchId,employeeId,paymentDate]
    );
    const balance = Number(owedResult.rows[0].amount_owed||0)-Number(paidResult.rows[0].paid_off||0);
    if (paymentAmount > balance) { const e=new Error(`Payment exceeds the outstanding shortage balance of UGX ${balance.toLocaleString("en-UG")}.`); e.statusCode=400; throw e; }

    const inserted = await client.query(
      `INSERT INTO branch_shortage_payments(till_id,branch_id,employee_id,amount,payment_date,note)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,till_id,amount,payment_date,note,created_at`, [tillId,branchId,employeeId,paymentAmount,paymentDate,note||null]
    );
    await client.query("COMMIT");
    res.status(201).json({message:"Shortage payment recorded successfully.",payment:inserted.rows[0]});
  } catch(e) { await client.query("ROLLBACK").catch(()=>{}); next(e); }
  finally { client.release(); }
}


// Reuse the authoritative GSS calculation for server-generated email reports.
// This wrapper deliberately calls the same controller logic rather than maintaining a second report calculation.
export async function loadGeneralShopStatus(branchId, businessDate) {
  return new Promise((resolve, reject) => {
    const req = { query: { branchId: String(branchId), businessDate: String(businessDate) } };
    const res = { json: (payload) => resolve(payload) };
    getGeneralShopStatus(req, res, reject);
  });
}

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

    // Every Record Balance is a permanent history event. A SHORT balance is
    // also a complete, independent shortage event. It must never be reduced
    // by the previous Till Balance difference because a previous shortage may
    // already have been partially or fully recovered through an explicit
    // settlement allocation. Settlement is event-specific and is the only
    // mechanism that reduces an event's outstanding amount.
    //
    // Example:
    //   Event #1: shortage 600,000; settlement 500,000 => outstanding 100,000
    //   Event #2: shortage 1,000,000                     => outstanding 1,000,000
    //   Total outstanding                                 = 1,100,000
    //
    // Therefore shortage_event_amount must equal the full shortage observed
    // by this balancing session, not current shortage minus previous shortage.
    const currentShortage = difference < 0 ? Math.abs(difference) : 0;
    const shortageEventAmount = Number(currentShortage.toFixed(2));

    // Keep excess handling unchanged for now. Excess does not participate in
    // the shortage/recovery event ledger.
    const previousBalanceResult = await client.query(
      `SELECT difference
       FROM till_balances
       WHERE till_id = $1
       ORDER BY balanced_at DESC, id DESC
       LIMIT 1`,
      [tillId]
    );
    const previousDifference = previousBalanceResult.rowCount
      ? Number(previousBalanceResult.rows[0].difference || 0)
      : null;
    const previousExcess = previousDifference !== null && previousDifference > 0
      ? previousDifference
      : 0;
    const currentExcess = difference > 0 ? difference : 0;
    const excessEventAmount = Number(Math.max(currentExcess - previousExcess, 0).toFixed(2));

    const balanceResult = await client.query(
      `INSERT INTO till_balances
       (till_id, employee_id, business_date, balanced_at, operating_capital,
        total_cash, total_float, actual_till_capital, difference, status,
        shortage_event_amount, excess_event_amount)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, till_id, employee_id, business_date, balanced_at,
                 operating_capital, total_cash, total_float,
                 actual_till_capital, difference, status,
                 shortage_event_amount, excess_event_amount`,
      [
        tillId, employee.id, businessDate, operatingCapital, totalCash,
        totalFloat, actualTillCapital, difference, status,
        shortageEventAmount, excessEventAmount,
      ]
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
    res.status(201).json({
      ...balance,
      attendant_name: employee.name,
      shortageEvent: {
        newShortage: shortageEventAmount,
        observedShortage: currentShortage,
        // Independent shortage events no longer derive from a previous shortage.
        // Keep the response field for compatibility without reintroducing the old subtraction model.
        previousShortage: null,
      },
      excessEvent: {
        newExcess: excessEventAmount,
        observedExcess: currentExcess,
        previousExcess,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
}


export async function getTillShortagePosition(req, res, next) {
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const date = String(req.query.businessDate || "").trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const error = new Error("Business date must use YYYY-MM-DD format.");
      error.statusCode = 400;
      throw error;
    }

    const tillResult = await pool.query(
      `SELECT t.id, t.name, t.branch_id
       FROM tills t
       WHERE t.id=$1`,
      [tillId]
    );
    if (!tillResult.rowCount) return res.status(404).json({ error: "Till not found." });
    const till = tillResult.rows[0];

    const attendantResult = await pool.query(
      `SELECT e.id AS employee_id, e.name AS employee_name
       FROM till_assignments ta
       JOIN employees e ON e.id=ta.employee_id
       WHERE ta.till_id=$1
         AND ta.started_at <= NOW()
         AND (ta.ended_at IS NULL OR ta.ended_at > NOW())
       ORDER BY ta.started_at DESC
       LIMIT 1`,
      [tillId]
    );

    const eventsResult = await pool.query(
      `WITH event_positions AS (
         SELECT p.till_balance_id,
                p.till_id,
                p.employee_id,
                p.employee_name,
                p.till_name,
                p.business_date::text AS business_date,
                p.shortage,
                p.observed_shortage,
                COALESCE(SUM(a.amount) FILTER (WHERE bsp.payment_date <= $2),0)::NUMERIC(18,2) AS recovered
         FROM till_shortage_event_positions p
         LEFT JOIN till_shortage_settlement_allocations a
           ON a.till_balance_id=p.till_balance_id
         LEFT JOIN branch_shortage_payments bsp
           ON bsp.id=a.payment_id
         WHERE p.till_id=$1
           AND p.business_date <= $2
         GROUP BY p.till_balance_id,p.till_id,p.employee_id,p.employee_name,p.till_name,p.business_date,p.shortage,p.observed_shortage
       )
       SELECT till_balance_id, employee_id, employee_name, till_name, business_date,
              shortage, observed_shortage, recovered,
              GREATEST(shortage-recovered,0)::NUMERIC(18,2) AS outstanding
       FROM event_positions
       ORDER BY business_date DESC, till_balance_id DESC`,
      [tillId, date]
    );

    const paymentsResult = await pool.query(
      `SELECT bsp.id, bsp.till_id, bsp.employee_id, e.name AS employee_name,
              bsp.amount, bsp.payment_date, bsp.note, bsp.created_at
       FROM branch_shortage_payments bsp
       JOIN employees e ON e.id=bsp.employee_id
       WHERE bsp.till_id=$1
         AND bsp.payment_date <= $2
       ORDER BY bsp.payment_date DESC, bsp.id DESC
       LIMIT 100`,
      [tillId, date]
    );

    const events = eventsResult.rows.map((event) => ({
      tillBalanceId: Number(event.till_balance_id),
      employeeId: Number(event.employee_id),
      employeeName: event.employee_name,
      tillName: event.till_name,
      businessDate: event.business_date,
      shortage: Number(event.shortage),
      observedShortage: Number(event.observed_shortage || event.shortage || 0),
      recovered: Number(event.recovered),
      outstanding: Number(event.outstanding),
    }));

    const payments = paymentsResult.rows.map((payment) => ({
      id: Number(payment.id),
      tillId: Number(payment.till_id),
      employeeId: Number(payment.employee_id),
      employeeName: payment.employee_name,
      amount: Number(payment.amount),
      paymentDate: payment.payment_date,
      note: payment.note || "",
      createdAt: payment.created_at,
    }));

    const shortageIncurred = events.reduce((sum, event) => sum + event.shortage, 0);
    const paymentsToDate = events.reduce((sum, event) => sum + event.recovered, 0);
    const outstanding = events.reduce((sum, event) => sum + event.outstanding, 0);
    const attendant = attendantResult.rows[0] || null;

    res.json({
      tillId,
      tillName: till.name,
      branchId: Number(till.branch_id),
      currentEmployeeId: attendant ? Number(attendant.employee_id) : null,
      currentEmployeeName: attendant?.employee_name || "",
      shortageIncurred,
      paymentsToDate,
      outstanding,
      asOfDate: date,
      events,
      payments,
    });
  } catch (error) {
    next(error);
  }
}

export async function recordTillShortagePayment(req, res, next) {
  const client = await pool.connect();
  try {
    const tillId = positiveId(req.params.tillId, "Till ID");
    const tillBalanceId = positiveId(req.body?.tillBalanceId, "Shortage event ID");
    const paymentDate = String(req.body?.paymentDate || "").trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      const error = new Error("Payment date must use YYYY-MM-DD format.");
      error.statusCode = 400;
      throw error;
    }

    const paymentAmount = money(req.body?.amount, "Payment amount");
    if (paymentAmount <= 0) {
      const error = new Error("Payment amount must be greater than zero.");
      error.statusCode = 400;
      throw error;
    }
    const note = String(req.body?.note || "").trim();

    await client.query("BEGIN");

    // Lock the Till first. Every settlement for this Till therefore serializes
    // before the outstanding amount is calculated.
    const tillResult = await client.query(
      `SELECT id, branch_id, name FROM tills WHERE id=$1 FOR UPDATE`,
      [tillId]
    );
    if (!tillResult.rowCount) {
      const error = new Error("Till not found.");
      error.statusCode = 404;
      throw error;
    }
    const till = tillResult.rows[0];

    // Lock the exact historical balance row. Settlement is always tied to a
    // specific balance event and never to an employee-level aggregate.
    const eventLock = await client.query(
      `SELECT id
       FROM till_balances
       WHERE id=$1 AND till_id=$2
       FOR UPDATE`,
      [tillBalanceId, tillId]
    );
    if (!eventLock.rowCount) {
      const error = new Error("The selected Till shortage event no longer exists for this Till.");
      error.statusCode = 404;
      throw error;
    }

    const eventResult = await client.query(
      `SELECT p.till_balance_id, p.till_id, p.branch_id, p.employee_id,
              p.employee_name, p.till_name, p.business_date::text AS business_date, p.shortage
       FROM till_shortage_event_positions p
       WHERE p.till_balance_id=$1
         AND p.till_id=$2`,
      [tillBalanceId, tillId]
    );
    if (!eventResult.rowCount) {
      const error = new Error("The selected Till shortage event no longer exists or is not a shortage event.");
      error.statusCode = 404;
      throw error;
    }
    const event = eventResult.rows[0];
    const eventBusinessDate = String(event.business_date).slice(0, 10);
    // Settlement may happen later on the same business date or on any later
    // business date. A settlement is rejected only when its business date
    // precedes the shortage event's business date. The actual created_at
    // timestamp remains the audit timestamp for when the repayment was entered.
    if (paymentDate < eventBusinessDate) {
      const error = new Error(
        `Settlement date cannot be earlier than the shortage event date (${eventBusinessDate}).`
      );
      error.statusCode = 400;
      throw error;
    }

    const allocationResult = await client.query(
      `SELECT COALESCE(SUM(a.amount) FILTER (WHERE bsp.payment_date <= $2),0)::NUMERIC(18,2) AS recovered
       FROM till_shortage_settlement_allocations a
       JOIN branch_shortage_payments bsp ON bsp.id=a.payment_id
       WHERE a.till_balance_id=$1`,
      [tillBalanceId, paymentDate]
    );
    const recovered = Number(allocationResult.rows[0]?.recovered || 0);
    const outstanding = Math.max(Number(event.shortage) - recovered, 0);

    if (outstanding <= 0) {
      const error = new Error("The selected Till shortage event is already fully settled.");
      error.statusCode = 409;
      throw error;
    }
    if (paymentAmount > outstanding) {
      const error = new Error(`Payment exceeds the selected shortage outstanding amount of UGX ${outstanding.toLocaleString("en-UG")}.`);
      error.statusCode = 400;
      throw error;
    }

    const inserted = await client.query(
      `INSERT INTO branch_shortage_payments
         (till_id,branch_id,employee_id,amount,payment_date,note)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,till_id,employee_id,amount,payment_date,note,created_at`,
      [tillId, till.branch_id, event.employee_id, paymentAmount, paymentDate, note || null]
    );
    const payment = inserted.rows[0];

    await client.query(
      `INSERT INTO till_shortage_settlement_allocations(payment_id,till_balance_id,amount)
       VALUES($1,$2,$3)`,
      [payment.id, tillBalanceId, paymentAmount]
    );

    const remaining = Number((outstanding - paymentAmount).toFixed(2));

    await client.query("COMMIT");

    res.status(201).json({
      message: remaining === 0
        ? "Till shortage event fully settled."
        : `Settlement recorded. UGX ${remaining.toLocaleString("en-UG")} remains outstanding on this shortage event.`,
      settlement: {
        id: Number(payment.id),
        tillId,
        tillBalanceId,
        tillName: till.name,
        employeeId: Number(event.employee_id),
        employeeName: event.employee_name,
        amount: Number(payment.amount),
        paymentDate: payment.payment_date,
        note: payment.note || "",
        eventOutstanding: remaining,
      },
    });
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
              tb.business_date::text AS business_date, tb.balanced_at, tb.operating_capital,
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
              tb.business_date::text AS business_date, tb.balanced_at, tb.operating_capital,
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

    // Balance History must reproduce the same operational components that were
    // part of the Till balancing event: Daily Transactions and the Till
    // Shortage Counter are historical reporting data, not current live inputs.
    // PostgreSQL DATE is deliberately returned as text above. Never pass a
    // JavaScript Date through toISOString() here because the server timezone
    // can shift a business date by one day (for example 2026-10-02 becomes
    // 2026-10-01 in UTC). Business dates are calendar dates, not timestamps.
    const historicalDate = String(balanceResult.rows[0].business_date).slice(0, 10);

    const transactionResult = await pool.query(
      `SELECT ttc.id, ttc.terminal_id, t.name AS terminal_name,
              sp.name AS service_provider_name,
              ttc.transaction_count
       FROM till_transaction_counts ttc
       JOIN terminals t ON t.id = ttc.terminal_id
       JOIN service_providers sp ON sp.id = t.service_provider_id
       WHERE ttc.till_id = $1
         AND ttc.business_date = $2
         AND ttc.terminal_id IS NOT NULL
       ORDER BY ttc.id`,
      [balanceResult.rows[0].till_id, historicalDate]
    );

    const shortageEventResult = await pool.query(
      `WITH event_positions AS (
         SELECT p.till_balance_id, p.employee_id, p.employee_name, p.business_date::text AS business_date,
                p.shortage, p.observed_shortage,
                COALESCE(
                  SUM(a.amount) FILTER (WHERE bsp.payment_date <= $2),
                  0
                )::NUMERIC(18,2) AS recovered
         FROM till_shortage_event_positions p
         LEFT JOIN till_shortage_settlement_allocations a
           ON a.till_balance_id = p.till_balance_id
         LEFT JOIN branch_shortage_payments bsp
           ON bsp.id = a.payment_id
         WHERE p.till_id = $1
           AND p.business_date <= $2
         GROUP BY p.till_balance_id, p.employee_id, p.employee_name, p.business_date,
                  p.shortage, p.observed_shortage
       )
       SELECT till_balance_id, employee_id, employee_name, business_date,
              shortage, observed_shortage, recovered,
              GREATEST(shortage - recovered, 0)::NUMERIC(18,2) AS outstanding
       FROM event_positions
       ORDER BY business_date DESC, till_balance_id DESC`,
      [balanceResult.rows[0].till_id, historicalDate]
    );

    const shortageEvents = shortageEventResult.rows.map((event) => ({
      tillBalanceId: Number(event.till_balance_id),
      employeeId: Number(event.employee_id),
      employeeName: event.employee_name,
      businessDate: event.business_date,
      shortage: Number(event.shortage),
      observedShortage: Number(event.observed_shortage || event.shortage || 0),
      recovered: Number(event.recovered),
      outstanding: Number(event.outstanding),
    }));

    const shortageIncurred = shortageEvents.reduce((sum, event) => sum + event.shortage, 0);
    const shortageRecovered = shortageEvents.reduce((sum, event) => sum + event.recovered, 0);
    const shortageOutstanding = shortageEvents.reduce((sum, event) => sum + event.outstanding, 0);

    res.json({
      balance: balanceResult.rows[0],
      cashItems: cashResult.rows,
      floatBalances: floatResult.rows,
      dailyTransactions: transactionResult.rows.map((row) => ({
        id: Number(row.id),
        terminalId: Number(row.terminal_id),
        terminalName: row.terminal_name,
        serviceProviderName: row.service_provider_name,
        transactionCount: Number(row.transaction_count || 0),
      })),
      shortageCounter: {
        asOfDate: historicalDate,
        shortageIncurred,
        recovered: shortageRecovered,
        outstanding: shortageOutstanding,
        events: shortageEvents,
      },
    });
  } catch (error) {
    next(error);
  }
}

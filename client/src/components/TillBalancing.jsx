import { useEffect, useMemo, useRef, useState } from "react";
import "../till-balancing.css";
import {
  createTillBalance,
  getTillBalanceDetails,
  getTillBalances,
  getTillBalancingContext,
  getTillShortagePosition,
  recordTillShortageSettlement,
  getTills,
  getCurrentUser,
  reorderTillTerminals,
} from "../services/api";

const NOTE_DENOMINATIONS = [50000, 20000, 10000, 5000, 2000, 1000];
const COIN_DENOMINATIONS = [1000, 500, 200, 100];
const emptyCash = Object.fromEntries(NOTE_DENOMINATIONS.map((value) => [value, ""]));
const emptyCoins = Object.fromEntries(COIN_DENOMINATIONS.map((value) => [value, ""]));

function localBusinessDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function inputNumber(value) {
  if (value === "" || value == null) return 0;
  return Number(String(value).replace(/,/g, ""));
}

function formatEntry(value) {
  if (value === "" || value == null) return "";
  const text = String(value).replace(/,/g, "");
  const [whole, decimal] = text.split(".");
  const formattedWhole = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(Number(whole || 0));
  return decimal !== undefined ? `${formattedWhole}.${decimal}` : formattedWhole;
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("en-UG") : "—";
}

export default function TillBalancing({ user }) {
  const [tills, setTills] = useState([]);
  const [tillId, setTillId] = useState("");
  const [context, setContext] = useState(null);
  const [history, setHistory] = useState([]);
  const [cash, setCash] = useState(emptyCash);
  const [coins, setCoins] = useState(emptyCoins);
  const [batch, setBatch] = useState("");
  const [floats, setFloats] = useState({});
  const [transactionCounts, setTransactionCounts] = useState({});
  const clearedTransactionContextRef = useRef(null);
  const [draggedTerminalId, setDraggedTerminalId] = useState(null)
  const [businessDate, setBusinessDate] = useState(localBusinessDate());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [recordedBalanceStatus, setRecordedBalanceStatus] = useState("");
  const [dailyTransactionValidationOpen, setDailyTransactionValidationOpen] = useState(false);
  const [shortagePosition, setShortagePosition] = useState(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementEvent, setSettlementEvent] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [settlementSaving, setSettlementSaving] = useState(false);

  async function loadTills() {
    let activeUser = user;

    if (
      !activeUser ||
      (activeUser.role === "SUPERVISOR" && !activeUser.branch_id)
    ) {
      activeUser = (await getCurrentUser())?.user || null;
    }

    if (!activeUser) {
      setTills([]);
      setTillId("");
      setError("Unable to determine the current user.");
      return;
    }

    if (activeUser.role === "BRANCH_USER") {
      if (!activeUser.till_id) {
        setTills([]);
        setTillId("");
        setError("No Till is assigned to this Branch User. Please contact the Manager.");
        return;
      }

      setTills([{
        id: Number(activeUser.till_id),
        name: activeUser.till_name || "Assigned Till",
        branch_id: activeUser.branch_id,
        status: "ACTIVE"
      }]);
      setTillId(String(activeUser.till_id));
      return;
    }

    const data = activeUser.role === "SUPERVISOR"
      ? await getTills(activeUser.branch_id)
      : await getTills();

    const activeTills = data.filter((till) => {
      if (till.status !== "ACTIVE") return false;
      if (activeUser.role === "SUPERVISOR") {
        return Number(till.branch_id) === Number(activeUser.branch_id);
      }
      return true;
    });

    setTills(activeTills);

    if (activeTills.length) {
      setTillId((current) =>
        current && activeTills.some((till) => String(till.id) === String(current))
          ? current
          : String(activeTills[0].id)
      );
    } else {
      setTillId("");
    }
  }

  async function loadContext(selectedId) {
    if (!selectedId) return;
    const [nextContext, nextHistory, nextShortage] = await Promise.all([
      getTillBalancingContext(selectedId, businessDate),
      getTillBalances(selectedId),
      getTillShortagePosition(selectedId, businessDate),
    ]);
    setContext(nextContext);
    setHistory(nextHistory);
    setShortagePosition(nextShortage);
    setSettlementEvent(null);
    setSettlementAmount("");
    setSettlementNote("");
    setSettlementOpen(false);

    const latestBalanceForDate = nextHistory.find(
      (item) => String(item.business_date).slice(0, 10) === businessDate
    );
    setRecordedBalanceStatus(latestBalanceForDate?.status || "");

    if (user?.role === "BRANCH_USER") {
      const assignedTillName =
        nextContext?.till?.name ||
        user?.till_name ||
        "Not assigned";

      setTills([{
        id: Number(selectedId),
        name: assignedTillName,
        branch_id: user?.branch_id,
        status: "ACTIVE",
      }]);
    }

    setFloats(Object.fromEntries(nextContext.terminals.map((terminal) => [terminal.terminal_id, ""])));
    const clearKey = `${selectedId}:${businessDate}`;
    if (clearedTransactionContextRef.current === clearKey) {
      setTransactionCounts(
        Object.fromEntries((nextContext.terminals || []).map((terminal) => [terminal.terminal_id, 0]))
      );
    } else {
      setTransactionCounts(
        Object.fromEntries((nextContext.dailyTransactions || []).map((terminal) => [terminal.terminal_id, terminal.transactionCount || 0]))
      );
    }
  }

  useEffect(() => {
    loadTills().catch((err) => setError(err.message));
  }, [user?.role, user?.branch_id, user?.till_id, user?.till_name]);

  useEffect(() => {
    if (!tillId) return;
    setSelectedHistory(null);
    loadContext(tillId).catch((err) => setError(err.message));
  }, [tillId, businessDate]);

  const totalNotes = useMemo(
    () => NOTE_DENOMINATIONS.reduce((sum, denomination) => sum + denomination * inputNumber(cash[denomination]), 0),
    [cash]
  );

  const totalCoins = useMemo(
    () => COIN_DENOMINATIONS.reduce((sum, denomination) => sum + denomination * inputNumber(coins[denomination]), 0),
    [coins]
  );

  const totalCash = totalNotes + inputNumber(batch) + totalCoins;
  const totalFloat = useMemo(
    () => Object.values(floats).reduce((sum, value) => sum + inputNumber(value), 0),
    [floats]
  );

  const actualCapital = totalCash + totalFloat;
  const operatingCapital = Number(context?.till?.operating_capital || 0);
  const difference = actualCapital - operatingCapital;
  const status = difference < 0 ? "SHORT" : difference > 0 ? "EXCESS" : "BALANCED";

  function setWholeNumber(setter, key, value) {
    if (value === "" || /^\d+$/.test(value)) setter((current) => ({ ...current, [key]: value }));
  }

  function setFloatValue(terminalId, value) {
    const raw = String(value).replace(/,/g, "");
    if (raw === "" || /^\d+(\.\d{0,2})?$/.test(raw)) {
      setFloats((current) => ({ ...current, [terminalId]: raw }));
    }
  }

  function setBatchValue(value) {
    const raw = String(value).replace(/,/g, "");
    if (raw === "" || /^\d+$/.test(raw)) setBatch(raw);
  }

  function reorderInMemory(sourceId, targetId) {
    if (!context?.terminals?.length || String(sourceId) === String(targetId)) return null;
    const current = [...context.terminals];
    const sourceIndex = current.findIndex((terminal) => String(terminal.terminal_id) === String(sourceId));
    const targetIndex = current.findIndex((terminal) => String(terminal.terminal_id) === String(targetId));
    if (sourceIndex < 0 || targetIndex < 0) return null;
    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);
    return current;
  }

  function handleTerminalDragStart(event, terminalId) {
    setDraggedTerminalId(String(terminalId));
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(terminalId));
  }

  function handleTerminalDragOver(event, targetId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!draggedTerminalId || String(draggedTerminalId) === String(targetId)) return;
    const reordered = reorderInMemory(draggedTerminalId, targetId);
    if (!reordered) return;
    setContext((existing) => ({ ...existing, terminals: reordered }));
  }

  async function handleTerminalDrop(event) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggedTerminalId;
    setDraggedTerminalId(null);
    if (!sourceId || !context?.terminals?.length) return;
    try {
      await reorderTillTerminals(tillId, context.terminals.map((terminal) => terminal.terminal_id));
    } catch (err) {
      setError(err.message);
      await loadContext(tillId);
    }
  }

  function handleTerminalDragEnd() {
    setDraggedTerminalId(null);
  }

  function setTransactionCount(key, value) {
    const raw = String(value).replace(/,/g, "");
    if (raw === "" || /^\d+$/.test(raw)) {
      setTransactionCounts((current) => ({ ...current, [key]: raw === "" ? 0 : Number(raw) }));
    }
  }

  const visibleDailyTransactions = useMemo(() => (context?.dailyTransactions || []).filter((terminal) => terminal?.terminal_id), [context]);

  async function submitBalance(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    // Daily Transactions require at least two non-zero entries before
    // a balance can be recorded. Other displayed terminals may legitimately
    // remain at zero when their transactions are not recorded for the day.
    const nonZeroDailyTransactions = visibleDailyTransactions.filter(
      (terminal) => Number(transactionCounts[terminal.terminal_id] || 0) > 0
    );

    if (nonZeroDailyTransactions.length < 2) {
      setDailyTransactionValidationOpen(true);
      return;
    }

    setSaving(true);
    try {
      const cashItems = NOTE_DENOMINATIONS.map((denomination) => ({
        itemType: "DENOMINATION",
        denomination,
        quantity: Number(cash[denomination] || 0),
      }));
      COIN_DENOMINATIONS.forEach((denomination) => {
        cashItems.push({
          itemType: "COINS",
          denomination,
          quantity: Number(coins[denomination] || 0),
        });
      });
      cashItems.push({ itemType: "BATCH", amount: inputNumber(batch) });

      const floatBalances = context.terminals.map((terminal) => ({
        terminalId: terminal.terminal_id,
        amount: inputNumber(floats[terminal.terminal_id]),
      }));

      const selectedTill = tills.find((item) => String(item.id) === String(tillId));
      const branchId = selectedTill?.branch_id ?? user?.branch_id ?? null;

      const result = await createTillBalance({
        tillId: Number(tillId),
        branchId: branchId == null ? null : Number(branchId),
        businessDate,
        cashItems,
        floatBalances,
        transactionCounts: Object.entries(transactionCounts).map(([terminalId, transactionCount]) => ({
          terminalId: Number(terminalId),
          transactionCount: Number(transactionCount || 0),
        })),
      });
      setMessage(`Balance recorded successfully — ${result.status}.`);
      setRecordedBalanceStatus(result.status);

      // Immediately refresh the Till Shortage Counter after recording a balance.
      // This preserves the established Till Balancing behaviour while the
      // branch-report event refreshes General Shop Status separately.
      const refreshedShortagePosition = await getTillShortagePosition(
        Number(tillId),
        businessDate
      );
      setShortagePosition(refreshedShortagePosition);

      // Reset every user-entered balancing field to zero after a successful record.
      // Keep the saved database values intact; only the current entry form is reset.
      const zeroCash = Object.fromEntries(
        NOTE_DENOMINATIONS.map((denomination) => [denomination, "0"])
      );
      const zeroCoins = Object.fromEntries(
        COIN_DENOMINATIONS.map((denomination) => [denomination, "0"])
      );
      const zeroFloats = Object.fromEntries(
        (context?.terminals || []).map((terminal) => [terminal.terminal_id, "0"])
      );
      const zeroTransactions = Object.fromEntries(
        (context?.terminals || []).map((terminal) => [terminal.terminal_id, 0])
      );

      clearedTransactionContextRef.current = `${tillId}:${businessDate}`;
      setCash(zeroCash);
      setCoins(zeroCoins);
      setBatch("0");
      setFloats(zeroFloats);
      setTransactionCounts(zeroTransactions);

      // Refresh history only. Do not reload the balancing context because that
      // would restore the just-recorded Daily Transaction counts into the entry form.
      const refreshedHistory = await getTillBalances(tillId);
      setHistory(refreshedHistory);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openSettlement(event) {
    if (!event || Number(event.outstanding || 0) <= 0) return;
    setSettlementEvent(event);
    setSettlementAmount(String(event.outstanding));
    const eventDate = String(event.businessDate || "").slice(0, 10);
    const defaultSettlementDate = businessDate && businessDate >= eventDate ? businessDate : eventDate;
    setSettlementDate(defaultSettlementDate);
    setSettlementNote("");
    setError("");
    setSettlementOpen(true);
  }

  async function settleShortage() {
    const amount = inputNumber(settlementAmount);
    const eventOutstanding = Number(settlementEvent?.outstanding || 0);
    if (!settlementEvent?.tillBalanceId) {
      setError("Select a shortage event to settle.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Enter a settlement amount greater than zero.");
      return;
    }
    const eventDate = String(settlementEvent.businessDate || "").slice(0, 10);
    const paymentDate = String(settlementDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      setError("Select a valid settlement date.");
      return;
    }
    if (paymentDate < eventDate) {
      setError(`Settlement date cannot be earlier than the shortage event date (${eventDate}).`);
      return;
    }
    if (amount > eventOutstanding) {
      setError("Settlement amount cannot exceed the outstanding amount on this shortage event.");
      return;
    }
    setSettlementSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await recordTillShortageSettlement(
        tillId,
        settlementEvent.tillBalanceId,
        amount,
        paymentDate,
        settlementNote,
        tills.find((item) => String(item.id) === String(tillId))?.branch_id ?? user?.branch_id ?? null
      );
      setMessage(result.message || "Shortage settlement recorded successfully.");
      setSettlementOpen(false);
      setSettlementEvent(null);
      setSettlementAmount("");
      setSettlementDate("");
      setSettlementNote("");
      const refreshed = await getTillShortagePosition(tillId, businessDate);
      setShortagePosition(refreshed);

      // The API also emits the shared branch-report event. Keep this local
      // refresh notification for compatibility with the existing shortage
      // channel, but include the authoritative branch id from the refreshed
      // shortage position.
      try {
        const channel = new BroadcastChannel("airtelcomm-shortage-updates");
        channel.postMessage({
          type: "SHORTAGE_SETTLEMENT_RECORDED",
          branchId: refreshed?.branchId ?? user?.branch_id ?? null,
          businessDate: paymentDate,
        });
        channel.close();
      } catch {
        // BroadcastChannel is optional; the shared branch-report event remains available.
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSettlementSaving(false);
    }
  }

  async function openHistory(id) {
    setHistoryError("");
    setHistoryLoading(true);
    try {
      const details = await getTillBalanceDetails(id);
      setSelectedHistory(details);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <main className={`app-shell till-balancing-page ${recordedBalanceStatus ? `till-status-${recordedBalanceStatus.toLowerCase()}` : ""}`}>
      <header className="page-header">
        <div>
          <div className="eyebrow">BUILD 003</div>
          <h1>Till Balancing</h1>
          <p>Count physical cash, capture current float positions, and compare Actual Till Capital with Operating Capital.</p>
        </div>
        <div className="status-pill">Till balancing</div>
      </header>

      <section className="balance-toolbar till-context-grid">
        {user?.role === "BRANCH_USER" ? (
          <div className="context-card till-name-card">
            <span>Till Name</span>
            <strong>{tills[0]?.name || user?.till_name || "Not assigned"}</strong>
          </div>
        ) : (
          <label className="context-card till-selector-card">
            <span>Till Name</span>
            <select value={tillId} onChange={(event) => setTillId(event.target.value)}>
              {tills.map((till) => <option key={till.id} value={till.id}>{till.name}</option>)}
            </select>
          </label>
        )}
        <label className="context-card date-card">
          <span>Business Date</span>
          <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
        </label>
        <div className="context-card attendant-card">
          <span>Attendant</span>
          <strong>{context?.attendant?.name || "No active attendant"}</strong>
        </div>
        <div className="context-card operating-capital-card">
          <span>Operating Capital</span>
          <strong>UGX {formatMoney(operatingCapital)}</strong>
        </div>
      </section>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={submitBalance}>
        <section className="balance-grid">
          <div className="panel">
            <div className="panel-heading">
              <div><h2>Cash Calculator</h2><p>Enter the physical cash counted at balancing time.</p></div>
              <strong>UGX {formatMoney(totalCash)}</strong>
            </div>
            <div className="cash-table">
              <div className="cash-row cash-head"><span>Denomination</span><span>Quantity</span><span>Amount</span></div>
              {NOTE_DENOMINATIONS.map((denomination) => {
                const qty = inputNumber(cash[denomination]);
                return <div className="cash-row" key={`note-${denomination}`}>
                  <span>UGX {formatMoney(denomination)}</span>
                  <input className="numeric-input" inputMode="numeric" value={cash[denomination]} onChange={(e) => setWholeNumber(setCash, denomination, e.target.value)} placeholder="0" aria-label={`Quantity of UGX ${denomination} notes`} />
                  <strong>UGX {formatMoney(denomination * qty)}</strong>
                </div>;
              })}
              <div className="section-divider">BATCH</div>
              <div className="cash-row special-row">
                <span>BATCH</span>
                <input className="numeric-input" inputMode="numeric" value={formatEntry(batch)} onChange={(e) => setBatchValue(e.target.value)} placeholder="0" aria-label="Batch amount" />
                <strong>UGX {formatMoney(inputNumber(batch))}</strong>
              </div>
              <div className="section-divider">COINS</div>
              {COIN_DENOMINATIONS.map((denomination) => {
                const qty = inputNumber(coins[denomination]);
                return <div className="cash-row coin-row" key={`coin-${denomination}`}>
                  <span>UGX {formatMoney(denomination)} coin</span>
                  <input className="numeric-input" inputMode="numeric" value={coins[denomination]} onChange={(e) => setWholeNumber(setCoins, denomination, e.target.value)} placeholder="0" aria-label={`Quantity of UGX ${denomination} coins`} />
                  <strong>UGX {formatMoney(denomination * qty)}</strong>
                </div>;
              })}
              <div className="cash-total-row"><span>Total Cash</span><strong>UGX {formatMoney(totalCash)}</strong></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div><h2>Float Balances</h2><p>Only active terminals assigned to this Till are shown.</p></div>
              <strong>UGX {formatMoney(totalFloat)}</strong>
            </div>
            {context?.terminals?.length ? <div className="float-list">
              {context.terminals.map((terminal) => <div
                className={`float-row ${String(draggedTerminalId) === String(terminal.terminal_id) ? "is-dragging" : ""}`}
                key={terminal.terminal_id}
                onDragOver={(event) => handleTerminalDragOver(event, terminal.terminal_id)}
                onDrop={handleTerminalDrop}
                style={{ gridTemplateColumns: "32px minmax(0, 1fr) 180px", alignItems: "center" }}
              >
                <button
                  type="button"
                  className="drag-handle"
                  style={{ width: "24px", minWidth: "24px", height: "24px", padding: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", justifySelf: "start" }}
                  draggable
                  onDragStart={(event) => handleTerminalDragStart(event, terminal.terminal_id)}
                  onDragEnd={handleTerminalDragEnd}
                  aria-label={`Drag to reorder ${terminal.terminal_name}`}
                  title="Drag to reorder"
                >
                  <span aria-hidden="true">⠿</span>
                </button>
                <div className="float-position-label" style={{ textAlign: "left", justifySelf: "stretch", minWidth: 0 }}>
                  <div style={{ textAlign: "left", width: "100%" }}><strong>{terminal.service_provider_name}</strong><span>{terminal.terminal_name}</span></div>
                </div>
                <input className="numeric-input" inputMode="decimal" value={formatEntry(floats[terminal.terminal_id] ?? "")} onChange={(e) => setFloatValue(terminal.terminal_id, e.target.value)} placeholder="0" aria-label={`${terminal.terminal_name} float balance`} />
              </div>)}
              <div className="cash-total-row"><span>Total Float</span><strong>UGX {formatMoney(totalFloat)}</strong></div>
            </div> : <div className="empty-state">No active terminals are assigned to this Till.</div>}
          </div>
        </section>

        <section className="panel transaction-panel">
        <div className="panel-heading">
          <div>
            <h2>Daily Transactions</h2>
            <p>Enter the daily transaction count for each active terminal assigned to this Till. General Shop Status derives its counts from these Till records.</p>
          </div>
          <strong>{visibleDailyTransactions.reduce((sum, terminal) => sum + Number(transactionCounts[terminal.terminal_id] || 0), 0).toLocaleString("en-UG")}</strong>
        </div>
        {visibleDailyTransactions.length ? (
          <div className="transaction-grid till-transaction-grid">
            {visibleDailyTransactions.map((terminal) => (
              <label key={terminal.terminal_id}>
                <span>{terminal.terminal_name}</span>
                <input
                  className="numeric-input"
                  inputMode="numeric"
                  value={transactionCounts[terminal.terminal_id] == null ? "" : Number(transactionCounts[terminal.terminal_id]).toLocaleString("en-UG")}
                  onChange={(event) => setTransactionCount(terminal.terminal_id, event.target.value)}
                  aria-label={`${terminal.terminal_name} daily transaction count`}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="empty-state">No active terminals are assigned to this Till.</div>
        )}
      </section>

      <section className={`result-card ${status.toLowerCase()}`}>
          <div><span>Actual Till Capital</span><strong>UGX {formatMoney(actualCapital)}</strong></div>
          <div><span>Difference</span><strong>{status === "BALANCED" ? "UGX 0" : `${status === "SHORT" ? "−" : "+"}UGX ${formatMoney(Math.abs(difference))}`}</strong></div>
          <div><span>Status</span><strong className={`result-status ${status.toLowerCase()}`}>{status === "BALANCED" ? "BALANCED" : `${status} BY UGX ${formatMoney(Math.abs(difference))}`}</strong></div>
          <button className="primary-button" type="submit" disabled={saving || !context?.attendant}>{saving ? "Saving..." : "Record Balance"}</button>
        </section>
      </form>

      {shortagePosition && (
        <section className={`panel shortage-settlement-panel ${shortagePosition.outstanding > 0 ? "has-debt" : "settled"}`}>
          <div className="panel-heading">
            <div>
              <h2>Till Shortage Counter</h2>
              <p>Shortage is tracked by its original Till balance event. Repayments are allocated directly to that event and never rewrite the physical Till balance.</p>
            </div>
            <strong>UGX {formatMoney(shortagePosition.outstanding)}</strong>
          </div>

          <div className="shortage-settlement-body">
            <div className="shortage-settlement-metrics">
              <div><span>Current attendant</span><strong>{shortagePosition.currentEmployeeName || "—"}</strong></div>
              <div><span>Total shortage incurred</span><strong>UGX {formatMoney(shortagePosition.shortageIncurred)}</strong></div>
              <div><span>Recovered to date</span><strong>UGX {formatMoney(shortagePosition.paymentsToDate)}</strong></div>
              <div><span>Outstanding shortage</span><strong className={shortagePosition.outstanding > 0 ? "debt" : "settled-value"}>UGX {formatMoney(shortagePosition.outstanding)}</strong></div>
              <div><span>Effective working capital</span><strong>UGX {formatMoney(Math.max(operatingCapital - Number(shortagePosition.outstanding || 0), 0))}</strong></div>
            </div>
          </div>

          <div className="shortage-events-section">
            <div className="shortage-section-heading">
              <div><strong>Shortage events</strong><span>Each event keeps its own original shortage and remaining balance.</span></div>
            </div>
            {shortagePosition.events?.length ? (
              <div className="shortage-events-table">
                <div className="shortage-event-row shortage-event-head">
                  <span>Date</span><span>Employee</span><span>Shortage</span><span>Recovered</span><span>Outstanding</span><span>Action</span>
                </div>
                {shortagePosition.events.map((event) => (
                  <div className="shortage-event-row" key={event.tillBalanceId}>
                    <span>{event.businessDate}</span>
                    <span>{event.employeeName}</span>
                    <span>UGX {formatMoney(event.shortage)}</span>
                    <span>UGX {formatMoney(event.recovered)}</span>
                    <span className={event.outstanding > 0 ? "debt" : "settled-value"}>UGX {formatMoney(event.outstanding)}</span>
                    <span>
                      {event.outstanding > 0 ? (
                        <button className="secondary-button settlement-button" type="button" onClick={() => openSettlement(event)}>Settle</button>
                      ) : (
                        <span className="settlement-status settled-status">SETTLED</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No Till shortage events have been recorded.</div>
            )}
          </div>

          {shortagePosition.payments?.length ? (
            <div className="shortage-payments-section">
              <div className="shortage-section-heading">
                <div><strong>Settlement history</strong><span>Recorded repayments against this Till.</span></div>
              </div>
              <div className="shortage-events-table shortage-payments-table">
                <div className="shortage-event-row shortage-event-head">
                  <span>Date</span><span>Employee</span><span>Amount</span><span>Note</span><span>Recorded</span>
                </div>
                {shortagePosition.payments.map((payment) => (
                  <div className="shortage-event-row" key={payment.id}>
                    <span>{payment.paymentDate}</span>
                    <span>{payment.employeeName}</span>
                    <span>UGX {formatMoney(payment.amount)}</span>
                    <span>{payment.note || "—"}</span>
                    <span>{formatDateTime(payment.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      <section className="panel history-panel">
        <div className="panel-heading">
          <div><h2>Balance History</h2><p>Every balancing event remains as a separate record. Select a record to inspect the full count.</p></div>
          <strong>{history.length} event{history.length === 1 ? "" : "s"}</strong>
        </div>
        {history.length ? <div className="history-table">
          <div className="history-row history-head"><span>Date / Time</span><span>Attendant</span><span>Actual Capital</span><span>Difference</span><span>Status</span><span>View</span></div>
          {history.map((item) => <div className="history-row" key={item.id}>
            <span>{formatDateTime(item.balanced_at)}</span>
            <span>{item.employee_name}</span>
            <span>UGX {formatMoney(item.actual_till_capital)}</span>
            <span>{item.status === "BALANCED" ? "UGX 0" : `${item.status === "SHORT" ? "−" : "+"}UGX ${formatMoney(Math.abs(item.difference))}`}</span>
            <span className={`result-status ${String(item.status).toLowerCase()}`}>{item.status}</span>
            <button className="history-view-button" type="button" onClick={() => openHistory(item.id)}>View details</button>
          </div>)}
        </div> : <div className="empty-state">No balancing events recorded for this Till yet.</div>}
      </section>

      {settlementOpen && settlementEvent && (
        <div className="modal-backdrop" onClick={() => !settlementSaving && setSettlementOpen(false)}>
          <div className="history-modal shortage-settlement-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><div className="eyebrow">SHORTAGE SETTLEMENT</div><h2>Settle Till Shortage</h2></div>
              <button className="modal-close" type="button" onClick={() => !settlementSaving && setSettlementOpen(false)} aria-label="Close shortage settlement">×</button>
            </div>
            <p>Record the actual repayment against the selected shortage event. This payment does not change the original physical Till balance.</p>
            <div className="settlement-detail-grid">
              <div><span>Shortage event date</span><strong>{settlementEvent.businessDate}</strong></div>
              <div><span>Employee responsible</span><strong>{settlementEvent.employeeName}</strong></div>
              <div><span>Original shortage</span><strong>UGX {formatMoney(settlementEvent.shortage)}</strong></div>
              <div><span>Already recovered</span><strong>UGX {formatMoney(settlementEvent.recovered)}</strong></div>
              <div><span>Outstanding before payment</span><strong>UGX {formatMoney(settlementEvent.outstanding)}</strong></div>
              <div><span>Remaining after payment</span><strong>UGX {formatMoney(Math.max(Number(settlementEvent.outstanding || 0) - inputNumber(settlementAmount), 0))}</strong></div>
              <label><span>Settlement date</span><input type="date" value={settlementDate} min={String(settlementEvent.businessDate || "").slice(0, 10)} onChange={(event) => setSettlementDate(event.target.value)} /></label>
              <label><span>Settlement amount</span><input className="numeric-input settlement-amount-input" inputMode="numeric" value={formatEntry(settlementAmount)} onChange={(event) => setSettlementAmount(event.target.value.replace(/,/g, ""))} autoFocus /></label>
              <label><span>Note (optional)</span><input value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} placeholder="e.g. Cash repayment" /></label>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setSettlementOpen(false)} disabled={settlementSaving}>Cancel</button>
              <button className="primary-button" type="button" onClick={settleShortage} disabled={settlementSaving}>{settlementSaving ? "Saving..." : "Confirm Settlement"}</button>
            </div>
          </div>
        </div>
      )}

      {dailyTransactionValidationOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="daily-transaction-validation-title">
          <div className="history-modal validation-modal">
            <div className="modal-header">
              <div>
                <div className="eyebrow">BALANCE VALIDATION</div>
                <h2 id="daily-transaction-validation-title">Daily Transactions Required</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setDailyTransactionValidationOpen(false)}
                aria-label="Close Daily Transactions validation"
              >
                ×
              </button>
            </div>
            <p>Please enter Daily Transactions for at least two terminals before recording the balance.</p>
            <div className="modal-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setDailyTransactionValidationOpen(false);
                  document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                OK — Enter Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {historyLoading && <div className="modal-backdrop"><div className="history-modal"><p>Loading balance details...</p></div></div>}
      {historyError && <div className="modal-backdrop"><div className="history-modal"><h3>Unable to open balance</h3><p>{historyError}</p><button className="secondary-button" type="button" onClick={() => setHistoryError("")}>Close</button></div></div>}
      {selectedHistory && <div className="modal-backdrop" onClick={() => setSelectedHistory(null)}>
        <div
          className="history-modal historical-till-mirror"
          onClick={(event) => event.stopPropagation()}
          style={{ maxWidth: "1180px", width: "calc(100vw - 48px)", maxHeight: "92vh", overflowY: "auto" }}
        >
          <div className="modal-header">
            <div>
              <div className="eyebrow">BALANCE #{selectedHistory.balance.id}</div>
              <h2>Historical Till Balancing</h2>
              <p>Read-only mirror of the Till Balancing record exactly as stored for this balancing event.</p>
            </div>
            <button className="modal-close" type="button" onClick={() => setSelectedHistory(null)} aria-label="Close historical Till balancing">×</button>
          </div>

          <section className="balance-toolbar till-context-grid historical-context-grid">
            <div className="context-card till-name-card">
              <span>Till Name</span>
              <strong>{selectedHistory.balance.till_name}</strong>
            </div>
            <div className="context-card date-card">
              <span>Business Date</span>
              <strong>{selectedHistory.balance.business_date}</strong>
            </div>
            <div className="context-card attendant-card">
              <span>Attendant</span>
              <strong>{selectedHistory.balance.employee_name}</strong>
            </div>
            <div className="context-card operating-capital-card">
              <span>Operating Capital</span>
              <strong>UGX {formatMoney(selectedHistory.balance.operating_capital)}</strong>
            </div>
          </section>

          <section className="balance-grid historical-mirror-grid">
            <div className="panel">
              <div className="panel-heading">
                <div><h2>Cash Calculator</h2><p>Physical cash captured during this historical balancing event.</p></div>
                <strong>UGX {formatMoney(selectedHistory.balance.total_cash)}</strong>
              </div>
              <div className="cash-table">
                <div className="cash-row cash-head"><span>Denomination</span><span>Quantity</span><span>Amount</span></div>
                {(selectedHistory.cashItems || []).map((item) => {
                  const isBatch = item.item_type === "BATCH";
                  const isCoins = item.item_type === "COINS";
                  const label = isBatch
                    ? "BATCH"
                    : `UGX ${formatMoney(item.denomination)} ${isCoins ? "coin" : "notes"}`;
                  const quantity = isBatch ? "—" : Number(item.quantity || 0).toLocaleString("en-UG");
                  return (
                    <div className="cash-row" key={item.id}>
                      <span>{label}</span>
                      <span className="numeric-input historical-readonly-value">{quantity}</span>
                      <strong>UGX {formatMoney(item.amount)}</strong>
                    </div>
                  );
                })}
                <div className="cash-total-row"><span>Total Cash</span><strong>UGX {formatMoney(selectedHistory.balance.total_cash)}</strong></div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div><h2>Float Balances</h2><p>Terminal float positions captured during this historical balancing event.</p></div>
                <strong>UGX {formatMoney(selectedHistory.balance.total_float)}</strong>
              </div>
              {(selectedHistory.floatBalances || []).length ? (
                <div className="float-list">
                  {selectedHistory.floatBalances.map((item) => (
                    <div className="float-row" key={item.id} style={{ gridTemplateColumns: "minmax(0, 1fr) 180px", alignItems: "center" }}>
                      <div className="float-position-label" style={{ textAlign: "left", justifySelf: "stretch", minWidth: 0 }}>
                        <div style={{ textAlign: "left", width: "100%" }}>
                          <strong>{item.service_provider_name}</strong>
                          <span>{item.terminal_name}</span>
                        </div>
                      </div>
                      <span className="numeric-input historical-readonly-value">UGX {formatMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className="cash-total-row"><span>Total Float</span><strong>UGX {formatMoney(selectedHistory.balance.total_float)}</strong></div>
                </div>
              ) : <div className="empty-state">No float balances were recorded for this event.</div>}
            </div>
          </section>

          <section className="panel transaction-panel historical-transaction-panel">
            <div className="panel-heading">
              <div>
                <h2>Daily Transactions</h2>
                <p>Terminal transaction counts recorded for the business date of this historical balancing event.</p>
              </div>
              <strong>{(selectedHistory.dailyTransactions || []).reduce((sum, terminal) => sum + Number(terminal.transactionCount || 0), 0).toLocaleString("en-UG")}</strong>
            </div>
            {(selectedHistory.dailyTransactions || []).length ? (
              <div className="transaction-grid till-transaction-grid">
                {selectedHistory.dailyTransactions.map((terminal) => (
                  <div key={terminal.id || terminal.terminalId} className="historical-transaction-field">
                    <span>{terminal.terminalName}</span>
                    <span className="numeric-input historical-readonly-value">{Number(terminal.transactionCount || 0).toLocaleString("en-UG")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No Daily Transaction counts were recorded for this business date.</div>
            )}
          </section>

          <section className={`result-card ${String(selectedHistory.balance.status || "").toLowerCase()}`}>
            <div><span>Actual Till Capital</span><strong>UGX {formatMoney(selectedHistory.balance.actual_till_capital)}</strong></div>
            <div><span>Difference</span><strong>{selectedHistory.balance.status === "BALANCED" ? "UGX 0" : `${selectedHistory.balance.status === "SHORT" ? "−" : "+"}UGX ${formatMoney(Math.abs(selectedHistory.balance.difference))}`}</strong></div>
            <div><span>Status</span><strong className={`result-status ${String(selectedHistory.balance.status).toLowerCase()}`}>{selectedHistory.balance.status}</strong></div>
            <div><span>Balanced At</span><strong>{formatDateTime(selectedHistory.balance.balanced_at)}</strong></div>
          </section>

          <section className={`panel shortage-settlement-panel ${(selectedHistory.shortageCounter?.outstanding || 0) > 0 ? "has-debt" : "settled"}`}>
            <div className="panel-heading">
              <div>
                <h2>Till Shortage Counter</h2>
                <p>Historical shortage position through {selectedHistory.shortageCounter?.asOfDate || selectedHistory.balance.business_date}.</p>
              </div>
              <strong>UGX {formatMoney(selectedHistory.shortageCounter?.outstanding)}</strong>
            </div>

            <div className="shortage-settlement-body">
              <div className="shortage-settlement-metrics">
                <div><span>Attendant</span><strong>{selectedHistory.balance.employee_name || "—"}</strong></div>
                <div><span>Total shortage incurred</span><strong>UGX {formatMoney(selectedHistory.shortageCounter?.shortageIncurred)}</strong></div>
                <div><span>Recovered to date</span><strong>UGX {formatMoney(selectedHistory.shortageCounter?.recovered)}</strong></div>
                <div><span>Outstanding shortage</span><strong className={Number(selectedHistory.shortageCounter?.outstanding || 0) > 0 ? "debt" : "settled-value"}>UGX {formatMoney(selectedHistory.shortageCounter?.outstanding)}</strong></div>
                <div><span>Effective working capital</span><strong>UGX {formatMoney(Math.max(Number(selectedHistory.balance.operating_capital || 0) - Number(selectedHistory.shortageCounter?.outstanding || 0), 0))}</strong></div>
              </div>
            </div>

            <div className="shortage-events-section">
              <div className="shortage-section-heading">
                <div><strong>Shortage events</strong><span>Historical events through the selected balance date.</span></div>
              </div>
              {selectedHistory.shortageCounter?.events?.length ? (
                <div className="shortage-events-table">
                  <div className="shortage-event-row shortage-event-head">
                    <span>Date</span><span>Employee</span><span>Shortage</span><span>Recovered</span><span>Outstanding</span><span>Status</span>
                  </div>
                  {selectedHistory.shortageCounter.events.map((event) => (
                    <div className="shortage-event-row" key={event.tillBalanceId}>
                      <span>{event.businessDate}</span>
                      <span>{event.employeeName}</span>
                      <span>UGX {formatMoney(event.shortage)}</span>
                      <span>UGX {formatMoney(event.recovered)}</span>
                      <span className={event.outstanding > 0 ? "debt" : "settled-value"}>UGX {formatMoney(event.outstanding)}</span>
                      <span className={`settlement-status ${event.outstanding > 0 ? "debt" : "settled-status"}`}>{event.outstanding > 0 ? "OUTSTANDING" : "SETTLED"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No Till shortage events had been recorded up to this balance date.</div>
              )}
            </div>
          </section>
        </div>
      </div>}
    </main>
  );
}

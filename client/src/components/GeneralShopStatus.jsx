import { useEffect, useMemo, useState } from "react";
import { getBranches, getGeneralShopStatus, saveGeneralShopStatus, recordShortagePayment } from "../services/api";
import "../general-shop-status-header-facelift.css";

const money = (n) => `UGX ${Number(n || 0).toLocaleString("en-UG")}`;
function localBusinessDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const today = localBusinessDate();

export default function GeneralShopStatus({ user }) {
  const [date, setDate] = useState(today);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === "SUPERVISOR" ? String(user.branch_id || "") : "");
  const [data, setData] = useState(null);
  const [accessories, setAccessories] = useState("");
  const [reason, setReason] = useState("");
  const [paymentInputs, setPaymentInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isHistorical = date < today;

  async function load() {
    setLoading(true); setError(""); setMessage("");
    try {
      if (!branchId) return;
      const result = await getGeneralShopStatus(Number(branchId), date);
      setData(result);
      setAccessories(result?.accessoriesCount ?? "");
      setReason(result?.reason || "");
      setPaymentInputs({});
    } catch (e) { setError(e?.message || "Failed to load General Shop Status."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (user?.role === "SUPERVISOR") {
      setBranches([]);
      setBranchId(String(user.branch_id || ""));
      return;
    }

    getBranches().then(rows => {
      const list = Array.isArray(rows) ? rows : [];
      setBranches(list);
      if (!list.length) {
        setBranchId("");
        setData(null);
        setLoading(false);
        return;
      }
      if (!branchId || !list.some((branch) => String(branch.id) === String(branchId))) {
        setBranchId(String(list[0].id));
      }
    }).catch(e => setError(e?.message || "Failed to load branches."));
  }, [user?.role, user?.branch_id]);  useEffect(() => { if (branchId) load(); }, [date, branchId]);

  const status = String(data?.totals?.status || "BALANCED").toUpperCase();
  const requiresReason = status === "SHORT" || status === "EXCESS";
  const positions = Array.isArray(data?.positions) ? data.positions : [];
  const tills = Array.isArray(data?.tills) ? data.tills : [];
  const dailyTransactions = Array.isArray(data?.dailyTransactions) ? data.dailyTransactions : [];
  const history = Array.isArray(data?.history) ? data.history : [];
  const shortages = Array.isArray(data?.shortageCounter) ? data.shortageCounter : [];

  const statusText = useMemo(() => {
    if (status === "BALANCED") return "BALANCED";
    if (status === "INCOMPLETE") return "BALANCING INCOMPLETE";
    const diff = Math.abs(Number(data?.totals?.difference || 0)).toLocaleString("en-UG");
    return `${status} BY UGX ${diff}`;
  }, [data, status]);

  const totalAdded = shortages.reduce((s, x) => s + Number(x.added || 0), 0);
  const totalOwed = shortages.reduce((s, x) => s + Number(x.amountOwed || 0), 0);
  const totalPaid = shortages.reduce((s, x) => s + Number(x.paidOff || 0), 0);
  const totalBalance = shortages.reduce((s, x) => s + Number(x.balance || 0), 0);
  const totalRecovered = shortages.reduce((s, x) => s + Number(x.paidOff || 0), 0);

  function formatEntry(value) {
    const raw = String(value ?? "").replace(/,/g, "");
    return /^\d*$/.test(raw) ? (raw ? Number(raw).toLocaleString("en-UG") : "") : "";
  }

  async function save() {
    if (isHistorical) { setError("Historical General Shop Status is read-only. Select today to make changes."); return; }
    setMessage(""); setError("");
    if (requiresReason && !reason.trim()) { setError("A brief reason is required when the General Shop Status is SHORT or EXCESS."); return; }
    setSaving(true);
    try {
      await saveGeneralShopStatus(Number(branchId), date, Number(String(accessories ?? "").replace(/,/g, "") || 0), reason.trim());
      setMessage("General Shop Status saved successfully."); await load();
    } catch (e) { setError(e?.message || "Failed to save General Shop Status."); }
    finally { setSaving(false); }
  }

  async function pay(employeeId, employeeName, outstanding) {
    if (isHistorical) { setError("Historical Branch Shortage Counter is read-only. Select today to record a payment."); return; }
    const raw = String(paymentInputs[employeeId] || "").replace(/,/g, "");
    const value = Number(raw || 0);
    if (!value || value <= 0) { setError("Enter a valid payment amount before recording a shortage payment."); return; }
    if (value > Number(outstanding || 0)) {
      setError(`Payment cannot exceed ${employeeName}'s outstanding balance of ${money(outstanding)}.`);
      return;
    }
    const confirmed = window.confirm(`Record ${money(value)} as a shortage payment for ${employeeName}?\n\nThis creates a permanent recovery entry and reduces the outstanding balance.`);
    if (!confirmed) return;
    setPaying(employeeId); setError(""); setMessage("");
    try {
      await recordShortagePayment(Number(branchId), employeeId, value, date, "");
      setPaymentInputs(v => ({ ...v, [employeeId]: "" }));
      setMessage(`${money(value)} shortage payment recorded for ${employeeName}.`); await load();
    } catch (e) { setError(e?.message || "Failed to record shortage payment."); }
    finally { setPaying(null); }
  }

  if (loading) return <main className="app-shell general-shop-status"><div className="loading-card">Loading General Shop Status…</div></main>;
  if (!branches.length && !(user?.role === "SUPERVISOR" && branchId)) return (
    <main className="app-shell general-shop-status">
      <header className="gss-report-header gss-professional-header">
        <div className="gss-heading-copy">
          <h1>GENERAL SHOP STATUS</h1>
          <p>Branch operating position and daily balancing overview</p>
        </div>

        <div className="gss-branch-identity" aria-label="Current branch">
          <span>BRANCH</span>
          <strong>{data?.branch?.name || user?.branch_name || "Branch not assigned"}</strong>
        </div>

        <div className="gss-header-date">
          <label>Business Date
            <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      </header>
      <div className="gss-status-line incomplete"><span>NO BRANCHES CONFIGURED</span></div>
      <div className="gss-empty gss-empty-state">
        No branches are currently configured. Go to <strong>Master Data</strong> and add a branch to begin using General Shop Status.
      </div>
    </main>
  );
  if (error && !data) return <main className="app-shell general-shop-status"><div className="error-message">{error}</div></main>;

  return (
    <main className="app-shell general-shop-status">
      <header className="gss-report-header">
        <h1>{data?.branch?.name || "GENERAL SHOP STATUS"}</h1>
        <div className="gss-header-controls">
          <span>GENERAL SHOP STATUS</span>
          {user?.role === "SUPERVISOR" ? (
            <span className="gss-branch-name">{data?.branch?.name || user?.branch_name || "Branch not assigned"}</span>
          ) : (
            <label>Branch
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          )}
          <label>Business Date <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </header>

      <div className={`gss-status-line ${status.toLowerCase()}`}>
        <span>{statusText}</span>
        {isHistorical && <span className="gss-history-badge">HISTORICAL • READ ONLY</span>}
      </div>
      {message && <div className="gss-message success-message">{message}</div>}
      {error && <div className="gss-message error-message">{error}</div>}

      <section className="gss-report-top">
        <div className="gss-report-panel gss-closing-float">
          <div className="gss-report-title">CLOSING FLOAT</div>
          <div className="gss-table">
            <div className="gss-row gss-head"><span>ITEM</span><span className="gss-number">CLOSING BAL</span></div>
            {positions.map((p, i) => <div className="gss-row" key={`${p.terminal_name}-${i}`}><span>{p.terminal_name || "—"}</span><span className="gss-number">{Number(p.amount || 0).toLocaleString("en-UG")}</span></div>)}
            {!positions.length && <div className="gss-empty">No closing float recorded.</div>}
            <div className="gss-row gss-total-row"><span>Total Float</span><span className="gss-number">{Number(data?.totals?.totalFloat || 0).toLocaleString("en-UG")}</span></div>
          </div>
        </div>

        <div className="gss-report-side">
          <div className="gss-report-panel">
            <div className="gss-report-title">DAILY TRANSACTIONS</div>
            <div className="gss-table">
              <div className="gss-row gss-head"><span>TERMINAL NAME</span><span className="gss-number">COUNT</span></div>
              {dailyTransactions.map((terminal, i) => <div className="gss-row" key={`${terminal.terminal_id}-${i}`}><span>{terminal.terminal_name || "—"}</span><span className="gss-number">{Number(terminal.transactionCount || 0).toLocaleString("en-UG")}</span></div>)}
            </div>
          </div>
          <div className="gss-report-panel gss-accessories-panel">
            <div className="gss-report-title">ACCESSORIES</div>
            <div className="gss-accessories-inline"><span>Total Sales :</span><input inputMode="numeric" value={formatEntry(accessories)} onChange={(e) => { const raw=e.target.value.replace(/,/g,""); if(/^\d*$/.test(raw)) setAccessories(raw); }} placeholder="0" readOnly={isHistorical} disabled={isHistorical} /><button type="button" onClick={save} disabled={saving || isHistorical}>{saving ? "Saving…" : "Save"}</button></div>
          </div>
        </div>
      </section>

      <section className="gss-capital-panel">
        <div className="gss-capital-row"><span>Total Float</span><strong>{money(data?.totals?.totalFloat)}</strong></div>
        <div className="gss-capital-row"><span>Total Cash</span><strong>{money(data?.totals?.totalCash)}</strong></div>
        <div className="gss-capital-row"><span>Branch Captl</span><strong>{money(data?.totals?.branchCapital)}</strong></div>
        <div className="gss-capital-row"><span>Imbalance</span><strong className={Number(data?.totals?.difference || 0) < 0 ? "negative" : Number(data?.totals?.difference || 0) > 0 ? "positive" : ""}>{data?.totals?.difference === 0 ? money(0) : `${data?.totals?.difference < 0 ? "Short -" : "Excess +"}${Math.abs(Number(data?.totals?.difference || 0)).toLocaleString("en-UG")}`}</strong></div>
        <div className="gss-capital-row gss-adjusted-row"><span>Capital incl. Shortage Position</span><strong>{money(data?.totals?.adjustedBranchCapital)}</strong></div>
        <div className="gss-capital-row gss-adjusted-row"><span>Adjusted Imbalance</span><strong className={Number(data?.totals?.adjustedDifference || 0) < 0 ? "negative" : Number(data?.totals?.adjustedDifference || 0) > 0 ? "positive" : ""}>{money(data?.totals?.adjustedDifference)}</strong></div>
        <div className="gss-reason-line"><span>Reason :</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={requiresReason ? "Brief reason for imbalance…" : ""} rows={2} readOnly={isHistorical} /><button type="button" onClick={save} disabled={saving || isHistorical}>{saving ? "Saving…" : "Save Status"}</button></div>
      </section>

      <section className="gss-report-panel gss-full-panel">
        <div className="gss-report-title">TILL POSITION</div>
        <div className="gss-table gss-till-table">
          <div className="gss-row gss-head gss-till-grid"><span>Till</span><span>Attendant</span><span className="gss-number">Operating</span><span className="gss-number">Actual</span><span className="gss-number">Difference</span><span>Status</span></div>
          {tills.map((x, i) => { const b=x.balance; const diff=Number(b?.difference||0); return <div className="gss-row gss-till-grid" key={x.till?.id || i}><span>{x.till?.name || "—"}</span><span>{b?.attendant_name || "—"}</span><span className="gss-number">{b ? money(b.operating_capital) : "—"}</span><span className="gss-number">{b ? money(b.actual_till_capital) : "—"}</span><span className={`gss-number ${diff<0?"negative":diff>0?"positive":""}`}>{b ? `${diff<0?"−":diff>0?"+":""}UGX ${Math.abs(diff).toLocaleString("en-UG")}` : "—"}</span><span className={`gss-status-tag ${String(b?.status||"NOT BALANCED").toLowerCase()}`}>{b?.status || "NOT BALANCED"}</span></div>; })}
        </div>
      </section>

      <section className="gss-report-panel gss-full-panel">
        <div className="gss-report-title">BRANCH SHORTAGE COUNTER</div>
        <div className="gss-table shortage-table">
          <div className="gss-row gss-head shortage-grid"><span>NAME</span><span className="gss-number">AMOUNT OWED</span><span className="gss-number">PAID OFF</span><span className="gss-number">BALANCE</span><span className="gss-number">ADDED</span><span></span></div>
          {shortages.map((s) => <div className="gss-row shortage-grid" key={s.employeeId}>
            <span>{s.name}</span>
            <span className="gss-number">{Number(s.amountOwed).toLocaleString("en-UG")}</span>
            <span className="gss-number gss-payment-cell"><strong className="gss-paid-total">{Number(s.paidOff || 0).toLocaleString("en-UG")}</strong><span className="gss-payment-entry"><input inputMode="numeric" aria-label={`New payment for ${s.name}`} value={formatEntry(paymentInputs[s.employeeId] || "")} onChange={(e)=>{const raw=e.target.value.replace(/,/g,""); if(/^\d*$/.test(raw)) setPaymentInputs(v=>({...v,[s.employeeId]:raw}));}} placeholder="Add" disabled={isHistorical || !Number(s.balance)} /><button type="button" onClick={()=>pay(s.employeeId,s.name,s.balance)} disabled={isHistorical || paying===s.employeeId || !Number(s.balance)}>{paying===s.employeeId?"…":"Pay"}</button></span></span>
            <span className="gss-number">{Number(s.balance).toLocaleString("en-UG")}</span>
            <span className="gss-number">{Number(s.added).toLocaleString("en-UG")}</span><span></span>
          </div>)}
          {!shortages.length && <div className="gss-empty">No shortage balances recorded.</div>}
          {shortages.length > 0 && <div className="gss-shortage-total"><span>Total</span><span>{totalOwed.toLocaleString("en-UG")}</span><span>{totalPaid.toLocaleString("en-UG")}</span><span>{totalBalance.toLocaleString("en-UG")}</span><span>{totalAdded.toLocaleString("en-UG")}</span><span></span></div>}
        </div>
        <div className="gss-shortage-note">Added is generated automatically from Till Balancing SHORT events. Amount Owed is the current outstanding amount after previous payments, Paid Off shows payments recorded for the selected date, and Balance is the current amount still owed. Historical shortage and payment records remain preserved.</div>
      </section>

      <section className="gss-report-panel gss-full-panel gss-history-section">
        <div className="gss-report-title">HISTORY STATUS</div>
        <div className="gss-table gss-history-table">
          <div className="gss-row gss-head gss-history-grid"><span>Date</span><span className="gss-number">Actual Capital</span><span className="gss-number">Difference</span><span>Status</span><span>Reason</span></div>
          {history.map((h,i)=>{
            const historicalDate = String(h.business_date || "").slice(0,10);
            const selected = historicalDate === date;
            return <button type="button" className={`gss-row gss-history-grid gss-history-row ${selected ? "selected" : ""}`} key={`${historicalDate}-${i}`} onClick={()=>historicalDate && setDate(historicalDate)} aria-label={`Open General Shop Status for ${historicalDate}`}>
              <span>{historicalDate||"—"}</span>
              <span className="gss-number">{money(h.actual_capital)}</span>
              <span className={`gss-number ${Number(h.difference||0)<0?"negative":Number(h.difference||0)>0?"positive":""}`}>{Number(h.difference||0)===0?money(0):`${Number(h.difference)<0?"−":"+"}UGX ${Math.abs(Number(h.difference)).toLocaleString("en-UG")}`}</span>
              <span className={`gss-status-tag ${String(h.status||"").toLowerCase()}`}>{h.status||"—"}</span>
              <span>{h.reason||"—"}</span>
            </button>;
          })}
          {!history.length && <div className="gss-empty">No historical branch status records yet.</div>}
        </div>
      </section>
    </main>
  );
}

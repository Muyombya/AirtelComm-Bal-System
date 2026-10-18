import { useEffect, useState } from "react";
import {
  getBranches,
  getTills,
  getAssignableTillShortages,
  getBranchShortageEmployees,
  getGeneralShopStatus,
  recordExternalShortagePayment,
  recordExternalShortageResponsibility,
} from "../services/api";
import "../branch-shortage-counter.css";

function businessDateToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const today = businessDateToday();
const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;

export default function BranchShortageCounter({ user }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === "SUPERVISOR" ? String(user.branch_id || "") : "");
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState([]);
  const [responsibilities, setResponsibilities] = useState([]);
  const [tills, setTills] = useState([]);
  const [assignableEvents, setAssignableEvents] = useState([]);
  const [form, setForm] = useState({ employeeId: "", tillId: "", tillBalanceId: "", mode: "TRANSFER", amount: "", note: "" });
  const [settlement, setSettlement] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const historical = date < today;

  useEffect(() => {
    if (user?.role === "SUPERVISOR") {
      setBranchId(String(user.branch_id || ""));
      return;
    }
    getBranches().then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      setBranches(list);
      setBranchId((current) => current && list.some((item) => String(item.id) === current) ? current : String(list[0]?.id || ""));
    }).catch((e) => setError(e?.message || "Could not load branches."));
  }, [user?.role, user?.branch_id]);

  async function load() {
    if (!branchId) return;
    setLoading(true);
    setError("");
    try {
      const [report, staff, branchTills, shortageEvents] = await Promise.all([
        getGeneralShopStatus(Number(branchId), date),
        getBranchShortageEmployees(Number(branchId)),
        getTills(Number(branchId)),
        getAssignableTillShortages(Number(branchId), date),
      ]);
      setResponsibilities(Array.isArray(report.externalShortages) ? report.externalShortages : []);
      setEmployees(Array.isArray(staff) ? staff : []);
      setTills(Array.isArray(branchTills) ? branchTills : []);
      setAssignableEvents(Array.isArray(shortageEvents) ? shortageEvents : []);
      setForm((current) => ({ ...current,
        employeeId: (Array.isArray(staff) ? staff : []).some((item) => String(item.id) === current.employeeId) ? current.employeeId : String(staff?.[0]?.id || ""),
        tillId: (Array.isArray(branchTills) ? branchTills : []).some((item) => String(item.id) === current.tillId) ? current.tillId : String(branchTills?.[0]?.id || ""),
        tillBalanceId: (Array.isArray(shortageEvents) ? shortageEvents : []).some((item) => String(item.tillBalanceId) === current.tillBalanceId) ? current.tillBalanceId : "",
        mode: current.mode || "TRANSFER",
      }));
    } catch (e) {
      setError(e?.message || "Could not load the Branch Shortage Counter.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [branchId, date]);

  async function addResponsibility(event) {
    event.preventDefault();
    if (saving || historical || !branchId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await recordExternalShortageResponsibility({
        branchId: Number(branchId),
        employeeId: Number(form.employeeId),
        tillId: Number(form.tillId),
        tillBalanceId: form.tillBalanceId ? Number(form.tillBalanceId) : null,
        reassignExistingTillShortage: form.mode === "TRANSFER",
        responsibilityDate: date,
        amount: Number(String(form.amount).replace(/,/g, "")),
        note: form.note.trim(),
      });
      setForm((current) => ({ ...current, amount: "", note: "" }));
      setMessage("Outside-Till responsibility added to the branch counter.");
      await load();
    } catch (e) {
      setError(e?.message || "Could not record this responsibility.");
    } finally {
      setSaving(false);
    }
  }

  async function settleResponsibility(event) {
    event.preventDefault();
    if (!settlement || saving || historical) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await recordExternalShortagePayment(settlement.id, {
        branchId: Number(branchId),
        paymentDate: date,
        amount: Number(String(settlementAmount).replace(/,/g, "")),
        note: settlementNote.trim(),
      });
      setSettlement(null);
      setSettlementAmount("");
      setSettlementNote("");
      setMessage("Settlement recorded. The Branch Status counter has been updated.");
      await load();
    } catch (e) {
      setError(e?.message || "Could not record this settlement.");
    } finally {
      setSaving(false);
    }
  }

  const totalBalance = responsibilities.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const totalPaidToday = responsibilities.reduce((sum, item) => sum + Number(item.paidToday || 0), 0);

  return (
    <main className="app-shell branch-shortage-counter">
      <header className="bsc-header">
        <div><span>BRANCH OPERATIONS</span><h1>Branch Shortage Counter</h1><p>Record and settle branch shortage responsibilities.</p></div>
        <div className="bsc-filters">
          <label><span>BRANCH</span>{user?.role === "SUPERVISOR" ? <strong>{user.branch_name || "Assigned branch"}</strong> : <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}</label>
          <label><span>BUSINESS DATE</span><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </header>

      {error && <div className="bsc-notice error" role="alert">{error}</div>}
      {message && <div className="bsc-notice success" role="status">{message}</div>}
      {historical && <div className="bsc-notice">Historical view is read-only. Select today to add or settle a responsibility.</div>}

      <section className="bsc-totals" aria-label="Outside-Till shortage totals">
        <div><span>OPEN OUTSIDE-TILL BALANCE</span><strong>{money(totalBalance)}</strong></div>
        <div><span>SETTLED ON SELECTED DATE</span><strong>{money(totalPaidToday)}</strong></div>
      </section>

      <section className="bsc-panel">
        <h2>Add Outside-Till Responsibility</h2>
        <p>Assign the source Till and responsible worker. Reassigning moves the amount from the Till attendant to this worker, across the Till’s open shortage events. Choose a separate responsibility only when it is not already included in the Till shortage.</p>
        <form className="bsc-form" onSubmit={addResponsibility}>
          <label><span>SOURCE TILL</span><select required value={form.tillId} onChange={(e) => setForm({ ...form, tillId: e.target.value, tillBalanceId: "" })}><option value="">Select Till</option>{tills.map((till) => <option key={till.id} value={till.id}>{till.name}</option>)}</select></label>
          <label><span>RESPONSIBILITY TYPE</span><select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value, tillBalanceId: "" })}><option value="TRANSFER">Reassign existing Till shortage</option><option value="INDEPENDENT">Separate responsibility</option></select></label>
          {form.mode === "TRANSFER" && <label><span>EVENT TO REASSIGN (OPTIONAL)</span><select value={form.tillBalanceId} onChange={(e) => { const event = assignableEvents.find((item) => String(item.tillBalanceId) === e.target.value); setForm({ ...form, tillBalanceId: e.target.value, tillId: event ? String(event.tillId) : form.tillId }); }}><option value="">Allocate across all open events on this Till</option>{assignableEvents.filter((item) => !form.tillId || String(item.tillId) === form.tillId).map((item) => <option key={item.tillBalanceId} value={item.tillBalanceId}>{item.businessDate} · {item.tillName} · {item.employeeName} · unpaid {money(item.available)}</option>)}</select></label>}
          <label><span>RESPONSIBLE WORKER</span><select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="">Select worker</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
          <label><span>AMOUNT (UGX)</span><input required min="1" step="1" inputMode="numeric" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="bsc-note-field"><span>REASON / REFERENCE</span><input required maxLength="240" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Bank deposit pending, CDM reference" /></label>
          <button type="submit" disabled={saving || historical || !employees.length || !tills.length}>{saving ? "Saving…" : "Add Responsibility"}</button>
        </form>
        {!employees.length && !loading && <div className="bsc-empty">No eligible workers found. Add the worker in Master Data first.</div>}
      </section>

      <section className="bsc-panel">
        <div className="bsc-panel-title"><div><h2>Assigned Shortage Responsibilities</h2><p>These amounts are consolidated under the responsible worker in Branch Status.</p></div><span>{responsibilities.length} entries for selected date</span></div>
        {loading ? <div className="bsc-empty">Loading responsibilities…</div> : responsibilities.length ? (
          <div className="bsc-table-wrap"><table className="bsc-table"><thead><tr><th>Worker</th><th>Date</th><th>Reason / Reference</th><th>Amount</th><th>Paid</th><th>Balance</th><th></th></tr></thead><tbody>
            {responsibilities.map((item) => <tr key={item.id}>
              <td data-label="Worker">{item.employeeName}{item.sourceAttendant && <small className="bsc-source-meta"> reassigned from {item.sourceAttendant}</small>}</td><td data-label="Date">{String(item.responsibilityDate).slice(0, 10)}</td><td data-label="Reason / Reference">{item.tillName && <><strong>{item.tillName}</strong>{item.sourceAttendant ? ` · from ${item.sourceAttendant}` : ""} · </>}{item.note}</td>
              <td data-label="Amount">{money(item.amount)}</td><td data-label="Paid">{money(item.paidToDate)}</td><td data-label="Balance" className={item.balance > 0 ? "bsc-debt" : ""}>{money(item.balance)}</td>
              <td>{item.balance > 0 && !historical && <button type="button" className="bsc-settle" onClick={() => { setSettlement(item); setSettlementAmount(String(item.balance)); setSettlementNote(""); }}>Settle</button>}</td>
            </tr>)}
          </tbody></table></div>
        ) : <div className="bsc-empty">No outside-Till responsibilities are open for this date.</div>}
      </section>

      {settlement && (
        <div className="bsc-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSettlement(null); }}>
          <form className="bsc-dialog" onSubmit={settleResponsibility}>
            <h2>Settle responsibility</h2>
            <p>{settlement.employeeName} · Remaining {money(settlement.balance)}</p>
            <label><span>AMOUNT PAID (UGX)</span><input required min="1" max={settlement.balance} step="1" inputMode="numeric" type="number" value={settlementAmount} onChange={(e) => setSettlementAmount(e.target.value)} /></label>
            <label><span>SETTLEMENT NOTE (OPTIONAL)</span><input maxLength="240" value={settlementNote} onChange={(e) => setSettlementNote(e.target.value)} placeholder="Bank confirmation or payment reference" /></label>
            <div><button type="button" className="bsc-cancel" disabled={saving} onClick={() => setSettlement(null)}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Record Settlement"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

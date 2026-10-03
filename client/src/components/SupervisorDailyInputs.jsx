import { useEffect, useMemo, useState } from "react";
import { getBranches, getGeneralShopStatus, saveSupervisorDailyInputs } from "../services/api";

function localBusinessDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const today = localBusinessDate();
const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;

function formatAmount(value) {
  const raw = String(value ?? "").replace(/,/g, "");
  return /^\d*$/.test(raw) ? (raw ? Number(raw).toLocaleString("en-UG") : "") : "";
}

export default function SupervisorDailyInputs({ user }) {
  const isManager = user?.role === "MANAGER";
  const isSupervisor = user?.role === "SUPERVISOR";
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(isSupervisor ? String(user?.branch_id || "") : "");
  const [date, setDate] = useState(today);
  const [accessories, setAccessories] = useState("");
  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("BALANCED");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const historical = date < today;
  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id) === String(branchId)),
    [branches, branchId]
  );

  async function loadBranches() {
    if (isSupervisor) {
      setBranchId(String(user?.branch_id || ""));
      return;
    }
    const rows = await getBranches();
    const list = Array.isArray(rows) ? rows : [];
    setBranches(list);
    if (!branchId && list.length) setBranchId(String(list[0].id));
  }

  async function loadEntry() {
    if (!branchId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getGeneralShopStatus(Number(branchId), date);
      setAccessories(data?.accessoriesCount ? Number(data.accessoriesCount).toLocaleString("en-UG") : "");
      setRemark(data?.imbalanceRemark || data?.reason || "");
      setStatus(String(data?.totals?.status || "BALANCED").toUpperCase());
    } catch (e) {
      setError(e?.message || "Failed to load Supervisor Daily Inputs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadBranches().catch((e) => {
      setError(e?.message || "Failed to load branches.");
      setLoading(false);
    });
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    if (!branchId) return;

    // A successful save intentionally clears the entry form. Remember that
    // state for this branch/date while the current browser session is open,
    // so navigating away and returning does not immediately repopulate the
    // values that were just entered.
    const clearedKey = `supervisorDailyInputsCleared:${branchId}:${date}`;
    if (sessionStorage.getItem(clearedKey) === "1") {
      setAccessories("");
      setRemark("");

      // Keep the freshly cleared form state when the user navigates away
      // and returns during the same browser session.
      const clearedKey = `supervisorDailyInputsCleared:${branchId}:${date}`;
      sessionStorage.setItem(clearedKey, "1");
      setError("");
      return;
    }

    loadEntry();
  }, [branchId, date]);

  async function save() {
    setError("");
    setMessage("");
    if (!branchId) return setError("No branch is assigned or selected.");
    if (historical) return setError("Historical Daily Inputs are read-only. Select today to make changes.");

    const value = Number(String(accessories || "").replace(/,/g, "") || 0);
    if (!Number.isInteger(value) || value < 0) return setError("Accessories Sales must be a valid non-negative whole amount.");
    if ((status === "SHORT" || status === "EXCESS") && !remark.trim()) {
      return setError("A brief Imbalance Remark is required when the branch is SHORT or EXCESS.");
    }

    setSaving(true);
    try {
      await saveSupervisorDailyInputs(Number(branchId), date, value, remark.trim());
      setMessage("Supervisor Daily Inputs saved successfully. General Shop Status has been updated.");
      // Clear the entry fields after a successful save so the form is ready
      // for the next daily input. Do not reload the saved values back into
      // the form here.
      setAccessories("");
      setRemark("");
    } catch (e) {
      setError(e?.message || "Failed to save Supervisor Daily Inputs.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !branchId) {
    return <main className="sdi-page"><div className="sdi-loading">Loading Supervisor Daily Inputs…</div></main>;
  }

  return (
    <main className="sdi-page">
      <header className="sdi-header">
        <div>
          <h1>SUPERVISOR DAILY INPUTS</h1>
          <p>Daily inputs that feed the General Shop Status report</p>
        </div>
        <div className="sdi-date-box">
          <span>BUSINESS DATE</span>
          <strong>{date}</strong>
        </div>
      </header>

      <section className="sdi-card">
        <div className="sdi-card-heading">DAILY REPORT INPUT</div>
        <div className="sdi-grid">
          <label>
            <span>BRANCH</span>
            {isSupervisor ? (
              <div className="sdi-readonly">{user?.branch_name || "Assigned branch"}</div>
            ) : (
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            )}
          </label>

          <label>
            <span>BUSINESS DATE</span>
            <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="sdi-divider" />

        <label className="sdi-field">
          <span>ACCESSORIES SALES <small>UGX</small></span>
          <input
            inputMode="numeric"
            value={accessories}
            disabled={historical}
            onChange={(e) => setAccessories(formatAmount(e.target.value))}
            placeholder="0"
          />
          <small className="sdi-help">Enter the total Accessories sales/activity amount for the selected business date.</small>
        </label>

        <label className="sdi-field">
          <span>IMBALANCE REMARK</span>
          <textarea
            rows="5"
            value={remark}
            disabled={historical}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter the supervisor's explanation or relevant remark for the day's imbalance."
          />
          <small className="sdi-help">This text is displayed in the General Shop Status → IMBALANCE REMARK section.</small>
        </label>

        <div className="sdi-status-line">
          <span>GENERAL SHOP STATUS</span>
          <strong className={`sdi-status ${status.toLowerCase()}`}>{status}</strong>
        </div>

        {historical && <div className="sdi-readonly-banner">HISTORICAL DATE • READ ONLY</div>}
        {error && <div className="sdi-alert error">{error}</div>}
        {message && <div className="sdi-alert success">{message}</div>}

        <div className="sdi-actions">
          <button type="button" onClick={save} disabled={saving || historical || !branchId}>
            {saving ? "Saving…" : "Save Daily Inputs"}
          </button>
        </div>
      </section>

      <section className="sdi-flow">
        <div><strong>SUPERVISOR DAILY INPUTS</strong><span>Enter Accessories Sales + Imbalance Remark</span></div>
        <div className="sdi-arrow">→</div>
        <div><strong>GENERAL SHOP STATUS</strong><span>Displays the saved values</span></div>
      </section>
    </main>
  );
}

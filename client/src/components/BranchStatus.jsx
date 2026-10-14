import { useEffect, useMemo, useRef, useState } from "react";
import { getBranches, getGeneralShopStatus } from "../services/api";
import { subscribeToBranchReportChanges } from "../services/branchReportEvents";
import "../branch-status.css";

const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
const compactNumber = (value) => Number(value || 0).toLocaleString("en-UG");
const figureTone = (value, emphasis = "") => Number(value) < 0 ? "negative-figure" : emphasis;

function providerGroup(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase();
  return ["mtn", "airtel", "roving", "africell", "warid"].some((word) => normalized.includes(word))
    ? "mobile"
    : "banks";
}

function printBranchStatus() {
  const report = document.querySelector(".branch-status-report");
  if (!report) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const styles = [...document.head.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => node.outerHTML)
    .join("\n");
  const branch = report.querySelector(".branch-status-report-head h2")?.textContent || "Branch";
  const reportDate = report.querySelector(".branch-status-report-head p")?.textContent || "";
  printWindow.addEventListener("load", () => {
    printWindow.document.title = `${branch} Branch Status ${reportDate}`;
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }, { once: true });
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${document.baseURI}"><title>Branch Status</title>${styles}</head><body>${report.outerHTML}</body></html>`);
  printWindow.document.close();
}

function localBusinessDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

const today = localBusinessDate();

export default function BranchStatus({ user }) {
  const [date, setDate] = useState(today);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === "SUPERVISOR" ? String(user.branch_id || "") : "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [fitMode, setFitMode] = useState(false);
  const requestId = useRef(0);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!fitMode) return undefined;
    document.body.classList.add("branch-status-fit-active");
    const fitReport = () => {
      const report = reportRef.current;
      if (!report) return;
      report.style.setProperty("--branch-status-fit-scale", "1");
      const bounds = report.getBoundingClientRect();
      const availableWidth = window.innerWidth - 12;
      const availableHeight = window.innerHeight - 48;
      const scale = Math.min(1, availableWidth / bounds.width, availableHeight / bounds.height);
      report.style.setProperty("--branch-status-fit-scale", String(Math.max(0.35, scale)));
    };
    const frame = window.requestAnimationFrame(fitReport);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fitReport);
    if (reportRef.current && observer) observer.observe(reportRef.current);
    window.addEventListener("resize", fitReport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", fitReport);
      if (observer) observer.disconnect();
      document.body.classList.remove("branch-status-fit-active");
      if (reportRef.current) reportRef.current.style.removeProperty("--branch-status-fit-scale");
    };
  }, [fitMode, data]);

  useEffect(() => {
    if (!fitMode) return undefined;
    const exitOnEscape = (event) => {
      if (event.key === "Escape") setFitMode(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [fitMode]);

  useEffect(() => {
    if (user?.role === "SUPERVISOR") {
      setBranchId(String(user.branch_id || ""));
      setBranches([]);
      return;
    }
    getBranches().then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      setBranches(list);
      setBranchId((current) => current && list.some((branch) => String(branch.id) === current)
        ? current
        : String(list[0]?.id || ""));
    }).catch((err) => setError(err?.message || "Unable to load branches."));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      setData(null);
      return undefined;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    getGeneralShopStatus(Number(branchId), date).then((result) => {
      if (requestId.current === currentRequest) setData(result);
    }).catch((err) => {
      if (requestId.current === currentRequest) setError(err?.message || "Unable to load Branch Status.");
    }).finally(() => {
      if (requestId.current === currentRequest) setLoading(false);
    });
    return () => { requestId.current += 1; };
  }, [branchId, date, refreshKey]);

  useEffect(() => {
    if (!branchId) return undefined;
    const refreshIfCurrent = (update) => {
      if (update?.branchId == null || String(update.branchId) !== String(branchId)) return;
      if (update?.businessDate && String(update.businessDate).slice(0, 10) !== String(date)) return;
      setRefreshKey((key) => key + 1);
    };
    const unsubscribe = subscribeToBranchReportChanges(refreshIfCurrent);
    let channel;
    try {
      channel = new BroadcastChannel("airtelcomm-shortage-updates");
      channel.onmessage = (event) => {
        const update = event?.data;
        if (update?.type === "SHORTAGE_SETTLEMENT_RECORDED") refreshIfCurrent(update);
      };
    } catch {
      channel = null;
    }
    return () => {
      unsubscribe();
      if (channel) channel.close();
    };
  }, [branchId, date]);

  const positions = useMemo(() => {
    const grouped = new Map();
    for (const item of data?.positions || []) {
      const name = String(item.service_provider_name || item.terminal_name || "Other").trim();
      const key = item.service_provider_id == null ? name.toLocaleLowerCase() : String(item.service_provider_id);
      const current = grouped.get(key) || { name, amount: 0 };
      current.amount += Number(item.amount || 0);
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const transactions = useMemo(() => {
    const grouped = new Map();
    for (const item of data?.dailyTransactions || []) {
      const name = String(item.service_provider_name || item.terminal_name || "Other").trim();
      const key = item.service_provider_id == null ? name.toLocaleLowerCase() : String(item.service_provider_id);
      const current = grouped.get(key) || { name, count: 0 };
      current.count += Number(item.transactionCount || 0);
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const groupedItems = useMemo(() => {
    const items = new Map();
    for (const item of positions) {
      const key = item.name.toLocaleLowerCase();
      const current = items.get(key) || { name: item.name, amount: 0, hasBalance: false, count: 0, hasTransactions: false };
      current.amount += Number(item.amount || 0);
      current.hasBalance = true;
      items.set(key, current);
    }
    for (const item of transactions) {
      const key = item.name.toLocaleLowerCase();
      const current = items.get(key) || { name: item.name, amount: 0, hasBalance: false, count: 0, hasTransactions: false };
      current.count += Number(item.count || 0);
      current.hasTransactions = true;
      items.set(key, current);
    }
    const groups = { mobile: [], banks: [] };
    for (const item of items.values()) groups[providerGroup(item.name)].push(item);
    for (const rows of Object.values(groups)) rows.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [positions, transactions]);

  const totals = data?.totals || {};
  const cashBook = data?.cashBook || {};
  const shortages = data?.shortageCounter || [];
  const status = String(totals.status || "INCOMPLETE").toUpperCase();
  const branchName = data?.branch?.name || user?.branch_name || "Branch";

  return (
    <main className={`app-shell branch-status-page${fitMode ? " fit-mode" : ""}`}>
      <header className="branch-status-controls">
        <div><span className="branch-status-kicker">DAILY BRANCH REPORT</span><h1>Branch Status</h1></div>
        <div className="branch-status-filters">
          {user?.role === "SUPERVISOR" ? <strong>{branchName}</strong> : (
            <label>Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select></label>
          )}
          <label>Date<input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <button type="button" onClick={printBranchStatus} disabled={!data || loading}>Save PDF</button>
          <button type="button" onClick={() => setFitMode(true)} disabled={!data || loading}>Fit to screen</button>
        </div>
      </header>

      {error && <div className="branch-status-message error" role="alert">{error}</div>}
      {loading && <div className="branch-status-message">Loading Branch Status…</div>}
      {!loading && !branchId && <div className="branch-status-message">No branch is available.</div>}

      {fitMode && <button type="button" className="branch-status-fit-exit" aria-label="Return to normal Branch Status view" onClick={() => setFitMode(false)}>← Back to report</button>}
      {data && !loading && <article ref={reportRef} className="branch-status-report">
        <header className="branch-status-report-head">
          <div><h2>{branchName}</h2><p>Branch Status · {date}</p></div>
          <span className={`branch-status-badge ${status.toLowerCase()}`}>{status}</span>
        </header>

        <section className="branch-status-consolidated">
          <h3>Closing Float and Transactions</h3>
          <div className="branch-status-group-grid">
            {[
              { key: "mobile", label: "Mobile Money", withTransactions: true },
              { key: "banks", label: "Banks", withTransactions: true },
            ].map((group) => {
              const rows = groupedItems[group.key];
              const balanceTotal = rows.filter((item) => item.hasBalance).reduce((sum, item) => sum + Number(item.amount || 0), 0);
              const transactionTotal = rows.filter((item) => item.hasTransactions).reduce((sum, item) => sum + Number(item.count || 0), 0);
              return <div className={`branch-status-group branch-status-group-${group.key}`} key={group.key}>
                <h4>{group.label}</h4>
                <div className={`branch-status-group-columns ${group.withTransactions ? "with-transactions" : ""}`}>
                  <span>Item Name</span><span>Closing Bal</span>{group.withTransactions && <span>Txns</span>}
                </div>
                {rows.map((item) => <div className={`branch-status-group-row ${group.withTransactions ? "with-transactions" : ""}`} key={item.name}>
                  <span>{item.name}</span>
                  <strong className={figureTone(item.amount)}>{item.hasBalance ? compactNumber(item.amount) : "—"}</strong>
                  {group.withTransactions && <strong className={figureTone(item.count)}>{item.hasTransactions ? compactNumber(item.count) : "—"}</strong>}
                </div>)}
                {!rows.length && <div className="branch-status-group-empty">—</div>}
                <div className={`branch-status-group-total ${group.withTransactions ? "with-transactions" : ""}`}>
                  <span>Totals</span><strong className={figureTone(balanceTotal)}>{rows.some((item) => item.hasBalance) ? compactNumber(balanceTotal) : "—"}</strong>
                  {group.withTransactions && <strong className={figureTone(transactionTotal)}>{rows.some((item) => item.hasTransactions) ? compactNumber(transactionTotal) : "—"}</strong>}
                </div>
              </div>;
            })}
          </div>
          <div className="branch-status-consolidated-totals">
            <div><span>Total Float</span><strong className={figureTone(totals.totalFloat)}>{money(totals.totalFloat)}</strong></div>
            <div><span>Total Transactions</span><strong className={figureTone(transactions.reduce((sum, item) => sum + item.count, 0))}>{transactions.reduce((sum, item) => sum + item.count, 0).toLocaleString("en-UG")}</strong></div>
          </div>
        </section>

        <section className="branch-status-capital">
          <div><span>Total Cash</span><strong className={figureTone(totals.totalCash)}>{money(totals.totalCash)}</strong></div>
          <div><span>Branch Capital</span><strong className={figureTone(totals.branchCapital)}>{money(totals.branchCapital)}</strong></div>
          <div><span>Operating Capital</span><strong className={figureTone(totals.branchOperatingCapital)}>{money(totals.branchOperatingCapital)}</strong></div>
          <div className="branch-status-shortage-total"><span>Shortage</span><strong className={figureTone(totals.totalShortageBalance, "shortage-figure")}>{money(totals.totalShortageBalance)}</strong></div>
          <div className="branch-status-extra-info">
            <div className="branch-status-reason"><span>Reason</span><strong>{data.reason || "—"}</strong></div>
            <div className="branch-status-accessories-info"><span>Accessories Sales</span><strong className={figureTone(data.accessoriesCount)}>{compactNumber(data.accessoriesCount)}</strong></div>
          </div>
        </section>

        <section className="branch-status-bottom-grid">
          <div className="branch-status-card">
            <h3>Cashbook</h3>
            <div className="branch-status-table">
              <div className="branch-status-expenses-heading">Expenses</div>
              {(cashBook.expenses || []).map((expense) => <div className="branch-status-row" key={expense.id}><span>{expense.description || expense.category || "Expense"}</span><strong className={figureTone(expense.amount)}>{money(expense.amount)}</strong></div>)}
              {!(cashBook.expenses || []).length && <div className="branch-status-empty">No expenses recorded</div>}
              <div className="branch-status-row total"><span>Total Spent</span><strong className={figureTone(cashBook.dailyExpenses)}>{money(cashBook.dailyExpenses)}</strong></div>
              <div className="branch-status-row"><span>Funds Added</span><strong className={figureTone(cashBook.dailyTopUps)}>{money(cashBook.dailyTopUps)}</strong></div>
              <div className="branch-status-row"><span>Opening Balance</span><strong className={figureTone(cashBook.openingBalance)}>{money(cashBook.openingBalance)}</strong></div>
              <div className="branch-status-row total"><span>Closing Balance</span><strong className={figureTone(cashBook.closingBalance)}>{money(cashBook.closingBalance)}</strong></div>
            </div>
          </div>
          <div className="branch-status-card">
            <h3>Branch Shortage Counter</h3>
            <div className="branch-status-shortage-head"><span>Name</span><span>Amount Owed</span><span>Paid Off</span><span>Balance</span></div>
            {(shortages || []).map((item) => <div className="branch-status-shortage-row" key={item.employeeId || item.employee_id}><span>{item.employee_name || item.name || "—"}</span><strong className={figureTone(item.amountOwed ?? item.amount_owed, "shortage-figure")}>{compactNumber(item.amountOwed ?? item.amount_owed)}</strong><strong className={figureTone(item.paymentsToday ?? item.payments_today)}>{compactNumber(item.paymentsToday ?? item.payments_today)}</strong><strong className={figureTone(item.balance, "shortage-figure")}>{compactNumber(item.balance)}</strong></div>)}
            {!shortages.length && <div className="branch-status-empty">No outstanding shortages</div>}
            <div className="branch-status-shortage-row total"><span>Total</span><strong className="shortage-figure">{compactNumber(shortages.reduce((sum, item) => sum + Number(item.amountOwed ?? item.amount_owed ?? 0), 0))}</strong><strong>{compactNumber(shortages.reduce((sum, item) => sum + Number(item.paymentsToday ?? item.payments_today ?? 0), 0))}</strong><strong className="shortage-figure">{compactNumber(totals.totalShortageBalance ?? shortages.reduce((sum, item) => sum + Number(item.balance || 0), 0))}</strong></div>
          </div>
        </section>
        <footer className="branch-status-foot">Figures are consolidated across the branch for the selected business date.</footer>
      </article>}
    </main>
  );
}

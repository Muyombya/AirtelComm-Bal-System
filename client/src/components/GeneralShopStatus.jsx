import { useEffect, useMemo, useState } from "react";
import { getBranches, getGeneralShopStatus, sendGeneralShopStatusEmail, getGeneralShopStatusPdf } from "../services/api";
import "../branch-performance-status.css";
import "../general-shop-status-email.css";

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
  const [branchId, setBranchId] = useState(
    user?.role === "SUPERVISOR" ? String(user.branch_id || "") : ""
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", message: "" });
  const [reportMessage, setReportMessage] = useState("");
  const [printGenerating, setPrintGenerating] = useState(false);
  const isHistorical = date < today;

  async function load() {
    if (!branchId) return;
    setLoading(true);
    setError("");
    try {
      const result = await getGeneralShopStatus(Number(branchId), date);
      setData(result);
    } catch (e) {
      setError(e?.message || "Failed to load Branch Performance Status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "SUPERVISOR") {
      setBranches([]);
      setBranchId(String(user.branch_id || ""));
      return;
    }

    getBranches()
      .then((rows) => {
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
      })
      .catch((e) => setError(e?.message || "Failed to load branches."));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    if (branchId) load();
  }, [date, branchId]);

  const status = String(data?.totals?.status || "BALANCED").toUpperCase();
  const positions = Array.isArray(data?.positions) ? data.positions : [];
  const tills = Array.isArray(data?.tills) ? data.tills : [];
  const dailyTransactions = Array.isArray(data?.dailyTransactions)
    ? data.dailyTransactions
    : [];
  const shortages = Array.isArray(data?.shortageCounter) ? data.shortageCounter : [];
  const cashBook = data?.cashBook || {};
  const cashBookExpenses = Array.isArray(cashBook.expenses) ? cashBook.expenses : [];

  const totalDifference = Number(data?.totals?.difference || 0);
  const adjustedDifference = Number(data?.totals?.adjustedDifference || 0);
  const totalFloat = Number(data?.totals?.totalFloat || 0);
  const totalCash = Number(data?.totals?.totalCash || 0);
  const branchCapital = Number(data?.totals?.branchCapital || 0);
  const adjustedBranchCapital = Number(data?.totals?.adjustedBranchCapital || 0);
  const totalTransactions = dailyTransactions.reduce(
    (sum, item) => sum + Number(item.transactionCount || 0),
    0
  );
  const totalShortageIncurred = shortages.reduce(
    (sum, item) => sum + Number(item.totalIncurred || 0),
    0
  );
  const totalShortageRecovered = shortages.reduce(
    (sum, item) => sum + Number(item.recoveredToDate || 0),
    0
  );
  const totalShortageOutstanding = shortages.reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0
  );
  const totalTodayShortage = shortages.reduce(
    (sum, item) => sum + Number(item.newShortage || 0),
    0
  );

  function openEmailDialog() {
    setReportMessage("");
    const branchName = data?.branch?.name || user?.branch_name || "Branch";
    setEmailError("");
    setEmailForm({
      to: "",
      cc: "",
      subject: `General Shop Status - ${branchName} - ${date}`,
      message: `Please find attached the General Shop Status report for ${branchName} for ${date}.`
    });
    setEmailOpen(true);
  }

  async function sendReportEmail(event) {
    event.preventDefault();
    setEmailError("");
    if (!emailForm.to.trim()) {
      setEmailError("Enter at least one recipient in To.");
      return;
    }
    if (!emailForm.subject.trim()) {
      setEmailError("Subject is required.");
      return;
    }
    setEmailSending(true);
    try {
      await sendGeneralShopStatusEmail(Number(branchId), date, emailForm);
      setEmailOpen(false);
      setError("");
      setReportMessage("Report Sent");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setEmailError(e?.message || "Failed to email the General Shop Status report.");
    } finally {
      setEmailSending(false);
    }
  }

  async function handlePrintPdf() {
    if (!branchId || printGenerating) return;
    setReportMessage("");
    setPrintGenerating(true);
    const printWindow = window.open("", "_blank");
    try {
      if (!printWindow) {
        throw new Error("The PDF window was blocked. Please allow pop-ups for this site and try again.");
      }
      printWindow.document.write("<p style='font-family:Arial,sans-serif;padding:24px'>Preparing PDF…</p>");
      printWindow.document.close();
      const { blob, filename } = await getGeneralShopStatusPdf(Number(branchId), date);
      const pdfUrl = URL.createObjectURL(blob);
      printWindow.location.href = pdfUrl;
      printWindow.document.title = filename;
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    } catch (e) {
      if (printWindow && !printWindow.closed) printWindow.close();
      setReportMessage(e?.message || "Failed to generate the PDF report.");
    } finally {
      setPrintGenerating(false);
    }
  }

  const statusText = useMemo(() => {
    if (status === "BALANCED") return "BALANCED";
    if (status === "INCOMPLETE") return "BALANCING INCOMPLETE";
    return status;
  }, [status]);

  if (loading) {
    return (
      <main className="app-shell branch-performance-status">
        <div className="bps-loading">Loading Branch Performance Status…</div>
      </main>
    );
  }

  if (!branches.length && !(user?.role === "SUPERVISOR" && branchId)) {
    return (
      <main className="app-shell branch-performance-status">
        <header className="bps-header">
          <div>
            <div className="bps-company-name">AIRTEL COMMUNICATIONS</div>
            <h1>BRANCH PERFORMANCE STATUS</h1>
            <p>Daily operating, balancing and recovery statement</p>
          </div>
          <div className="bps-header-actions">
            <button type="button" className="bps-print-button" onClick={handlePrintPdf}>
              Print PDF
            </button>
            <div className="bps-header-meta">
              <div><span>BUSINESS DATE</span><strong>{date}</strong></div>
            </div>
          </div>
        </header>
        <div className="bps-status-bar incomplete">NO BRANCHES CONFIGURED</div>
        <div className="bps-empty">
          No branches are currently configured. Go to <strong>Master Data</strong> and add a branch to begin.
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="app-shell branch-performance-status">
        <div className="bps-error">{error}</div>
      </main>
    );
  }

  const branchName = data?.branch?.name || user?.branch_name || "Branch not assigned";
  const imbalanceRemark = data?.imbalanceRemark || data?.reason || "";

  return (
    <main className="app-shell branch-performance-status">
      <header className="bps-header">
        <div className="bps-report-heading">
          <div className="bps-company-name">AIRTEL COMMUNICATIONS</div>
          <h1>{String(branchName).toUpperCase()} BRANCH PERFORMANCE REPORT</h1>
          <p>Daily operating, balancing and recovery statement</p>
        </div>

        <div className="bps-header-actions">
          <button type="button" className="bps-print-button" onClick={handlePrintPdf} disabled={printGenerating}>
            {printGenerating ? "Preparing PDF…" : "Print PDF"}
          </button>
          <button type="button" className="gss-email-button" onClick={openEmailDialog}>
            Email Report
          </button>
          <div className="bps-header-meta">
            <div>
              <span>BRANCH</span>
              {user?.role === "SUPERVISOR" ? (
                <strong>{branchName}</strong>
              ) : (
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}
            </div>
            <label>
              <span>BUSINESS DATE</span>
              <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
        </div>
      </header>

      {reportMessage && (
        <div
          className="bps-message success"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 99999,
            margin: 0,
            padding: "14px 22px",
            background: "#eaf7ee",
            color: "#176b35",
            border: "1px solid #8dcc9e",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            fontSize: "14px",
            fontWeight: 800,
            minWidth: "140px",
            textAlign: "center"
          }}
        >
          {reportMessage}
        </div>
      )}

      <div className={`bps-status-bar ${status.toLowerCase()}`}>
        <strong>{statusText}</strong>
        {isHistorical && <span>HISTORICAL • READ ONLY</span>}
      </div>

      {error && <div className="bps-message error">{error}</div>}

      <section className="bps-section">
        <div className="bps-section-title">BRANCH OPERATING POSITION</div>
        <div className="bps-statement">
          <div className="bps-line bps-column-head">
            <span>POSITION</span>
            <span className="bps-number">CURRENT DAY</span>
          </div>
          <div className="bps-line"><span>Total Float</span><span className="bps-number">{money(totalFloat)}</span></div>
          <div className="bps-line"><span>Total Cash</span><span className="bps-number">{money(totalCash)}</span></div>
          <div className="bps-line"><span>Branch Operating Capital</span><span className="bps-number">{money(branchCapital)}</span></div>
          <div className="bps-line bps-subtotal"><span>Actual Branch Capital</span><span className="bps-number">{money(totalFloat + totalCash)}</span></div>
          <div className="bps-line">
            <span>Imbalance</span>
            <span className={`bps-number ${totalDifference < 0 ? "negative" : totalDifference > 0 ? "positive" : ""}`}>
              {totalDifference === 0 ? money(0) : `${totalDifference < 0 ? "−" : "+"}${money(Math.abs(totalDifference))}`}
            </span>
          </div>
        </div>
      </section>

      <section className="bps-section bps-remark-section">
        <div className="bps-section-title">IMBALANCE REMARK</div>
        <div className="bps-remark-block">
          <div className="bps-remark-source">SUPERVISOR REMARK</div>
          <div className="bps-remark-text">{imbalanceRemark || "No imbalance remark has been recorded for this business date."}</div>
          <div className="bps-remark-footnote">
            This report is read-only. The remark will be entered through the Supervisor Imbalance Remark module for the selected branch and business date.
          </div>
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">TILL PERFORMANCE</div>
        <div className="bps-table">
          <div className="bps-table-row bps-table-head bps-till-grid">
            <span>TILL</span><span>ATTENDANT</span><span className="bps-number">OPERATING CAPITAL</span>
            <span className="bps-number">ACTUAL CAPITAL</span><span className="bps-number">DIFFERENCE</span><span>STATUS</span>
          </div>
          {tills.map((item, index) => {
            const balance = item.balance;
            const diff = Number(balance?.difference || 0);
            const tillStatus = balance?.status || "NOT BALANCED";
            return (
              <div className="bps-table-row bps-till-grid" key={item.till?.id || index}>
                <span>{item.till?.name || "—"}</span>
                <span>{balance?.attendant_name || "—"}</span>
                <span className="bps-number">{balance ? money(balance.operating_capital) : "—"}</span>
                <span className="bps-number">{balance ? money(balance.actual_till_capital) : "—"}</span>
                <span className={`bps-number ${diff < 0 ? "negative" : diff > 0 ? "positive" : ""}`}>
                  {balance ? (diff === 0 ? money(0) : `${diff < 0 ? "−" : "+"}${money(Math.abs(diff))}`) : "—"}
                </span>
                <span className={`bps-status ${String(tillStatus).toLowerCase().replace(/\s+/g, "-")}`}>{tillStatus}</span>
              </div>
            );
          })}
          {!tills.length && <div className="bps-empty-row">No Till records available for this date.</div>}
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">DAILY TRANSACTION ACTIVITY</div>
        <div className="bps-transaction-compact">
          {dailyTransactions.map((item, index) => (
            <div className="bps-transaction-item" key={`${item.terminal_id || item.terminal_name}-${index}`}>
              <span>{item.terminal_name || "—"}</span>
              <strong>{Number(item.transactionCount || 0).toLocaleString("en-UG")}</strong>
            </div>
          ))}
          {!dailyTransactions.length && <div className="bps-empty-row">No Daily Transactions recorded.</div>}
          <div className="bps-transaction-total">
            <span>TOTAL TRANSACTIONS</span>
            <strong>{totalTransactions.toLocaleString("en-UG")}</strong>
          </div>
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">CLOSING FLOAT</div>
        <div className="bps-float-compact">
          {positions.map((position, index) => (
            <div className="bps-float-item" key={`${position.terminal_name}-${index}`}>
              <span>{position.terminal_name || "—"}</span>
              <strong>{money(position.amount)}</strong>
            </div>
          ))}
          {!positions.length && <div className="bps-empty-row">No closing float recorded.</div>}
          <div className="bps-float-total">
            <span>TOTAL FLOAT</span><strong>{money(totalFloat)}</strong>
          </div>
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">CASH BOOK POSITION</div>
        <div className="bps-cashbook-grid">
          <div><span>OPENING BALANCE</span><strong>{money(cashBook.openingBalance)}</strong></div>
          <div><span>TODAY'S TOP UPS</span><strong className="positive">{money(cashBook.dailyTopUps)}</strong></div>
          <div><span>TODAY'S EXPENSES</span><strong className="negative">{money(cashBook.dailyExpenses)}</strong></div>
          <div><span>NET DAILY MOVEMENT</span><strong className={Number(cashBook.dailyNetMovement || 0) < 0 ? "negative" : Number(cashBook.dailyNetMovement || 0) > 0 ? "positive" : ""}>{money(cashBook.dailyNetMovement)}</strong></div>
          <div className="bps-cashbook-closing"><span>CASH BOOK CLOSING BALANCE</span><strong>{money(cashBook.closingBalance)}</strong></div>
        </div>

        <div className="bps-expense-subsection">
          <div className="bps-expense-heading">EXPENSES RECORDED ON {date}</div>
          <div className="bps-expense-table">
            <div className="bps-expense-row bps-expense-head">
              <span>CATEGORY</span><span>DESCRIPTION</span><span className="bps-number">AMOUNT</span>
            </div>
            {cashBookExpenses.map((expense) => (
              <div className="bps-expense-row" key={expense.id}>
                <span>{expense.category || "Other"}</span>
                <span>{expense.description || "—"}</span>
                <strong className="bps-number negative">{money(expense.amount)}</strong>
              </div>
            ))}
            {!cashBookExpenses.length && (
              <div className="bps-empty-row">No Cash Book expenses were recorded for the selected business date.</div>
            )}
            <div className="bps-expense-row bps-total-row">
              <strong>TOTAL EXPENSES</strong><span></span><strong className="bps-number negative">{money(cashBook.dailyExpenses)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">ACCESSORIES</div>
        <div className="bps-statement">
          <div className="bps-line">
            <span>Accessories Activity / Sales</span>
            <span className="bps-number" style={{ fontWeight: 800, fontSize: "1.2rem" }}>{money(data?.accessoriesCount || 0)}</span>
          </div>
        </div>
        <div className="bps-remark-footnote">
          Source: Supervisor Accessories module. Until that module is introduced, this report remains compatible with the existing branch status source.
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">SHORTAGE & RECOVERY</div>
        <div className="bps-table">
          <div className="bps-table-row bps-table-head bps-shortage-grid">
            <span>EMPLOYEE</span><span>TILL</span><span className="bps-number">INCURRED</span>
            <span className="bps-number">RECOVERED</span><span className="bps-number">OUTSTANDING</span><span className="bps-number">TODAY'S SHORTAGE</span>
          </div>
          {shortages.map((item) => (
            <div className="bps-table-row bps-shortage-grid" key={item.employeeId}>
              <span>{item.name}</span>
              <span>{item.tillName || "—"}</span>
              <span className="bps-number">{money(item.totalIncurred)}</span>
              <span className="bps-number positive">{money(item.recoveredToDate)}</span>
              <span className={`bps-number ${Number(item.balance || 0) > 0 ? "negative" : ""}`}>{money(item.balance)}</span>
              <span className="bps-number">{money(item.newShortage)}</span>
            </div>
          ))}
          {shortages.length > 0 && (
            <div className="bps-table-row bps-total-row bps-shortage-grid">
              <strong>TOTAL</strong><span></span>
              <strong className="bps-number">{money(totalShortageIncurred)}</strong>
              <strong className="bps-number positive">{money(totalShortageRecovered)}</strong>
              <strong className="bps-number negative">{money(totalShortageOutstanding)}</strong>
              <strong className="bps-number">{money(totalTodayShortage)}</strong>
            </div>
          )}
          {!shortages.length && <div className="bps-empty-row">No shortage or recovery records available for the selected date.</div>}
        </div>
        <div className="bps-footnote">
          TODAY'S SHORTAGE is the sum of all SHORT Till Balance events recorded for the selected business date. Each balancing event is treated as its own shortage event; it is not the employee's total outstanding debt. Recovery reduces outstanding debt through explicit settlement allocations.
        </div>
      </section>

      <section className="bps-section">
        <div className="bps-section-title">MANAGEMENT ATTENTION</div>
        <div className="bps-attention">
          {tills.filter((item) => String(item.balance?.status || "").toUpperCase() === "SHORT").map((item) => (
            <div key={`short-${item.till?.id}`}>• {item.till?.name || "Till"} — shortage requires attention.</div>
          ))}
          {tills.filter((item) => String(item.balance?.status || "").toUpperCase() === "EXCESS").map((item) => (
            <div key={`excess-${item.till?.id}`}>• {item.till?.name || "Till"} — excess recorded.</div>
          ))}
          {shortages.filter((item) => Number(item.balance || 0) > 0).map((item) => (
            <div key={`debt-${item.employeeId}`}>• {item.name} — outstanding shortage of {money(item.balance)}.</div>
          ))}
          {!tills.some((item) => ["SHORT", "EXCESS"].includes(String(item.balance?.status || "").toUpperCase()))
            && !shortages.some((item) => Number(item.balance || 0) > 0)
            && <div>• No outstanding balancing exceptions for the selected date.</div>}
        </div>
      </section>

      {emailOpen && (
        <div className="gss-email-overlay" role="dialog" aria-modal="true" aria-labelledby="gss-email-title">
          <form className="gss-email-dialog" onSubmit={sendReportEmail}>
            <div className="gss-email-header">
              <div>
                <h2 id="gss-email-title">Email General Shop Status</h2>
                <p>{data?.branch?.name || user?.branch_name || "Branch"} • {date}</p>
              </div>
              <button type="button" className="gss-email-close" onClick={() => setEmailOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="gss-email-field">
              <label htmlFor="gss-email-to">To</label>
              <div className="gss-email-help">Separate multiple addresses with commas</div>
              <input id="gss-email-to" value={emailForm.to} onChange={(e) => setEmailForm((v) => ({ ...v, to: e.target.value }))} placeholder="recipient@example.com" autoFocus />
            </div>
            <div className="gss-email-field">
              <label htmlFor="gss-email-cc">CC <span>Optional</span></label>
              <input id="gss-email-cc" value={emailForm.cc} onChange={(e) => setEmailForm((v) => ({ ...v, cc: e.target.value }))} placeholder="cc@example.com" />
            </div>
            <div className="gss-email-field">
              <label htmlFor="gss-email-subject">Subject</label>
              <input id="gss-email-subject" value={emailForm.subject} onChange={(e) => setEmailForm((v) => ({ ...v, subject: e.target.value }))} maxLength={180} />
            </div>
            <div className="gss-email-field">
              <label htmlFor="gss-email-message">Message <span>Optional</span></label>
              <textarea id="gss-email-message" value={emailForm.message} onChange={(e) => setEmailForm((v) => ({ ...v, message: e.target.value }))} maxLength={5000} />
            </div>
            {emailError && <div className="gss-email-error">{emailError}</div>}
            <div className="gss-email-actions">
              <button type="button" className="gss-email-cancel" onClick={() => setEmailOpen(false)} disabled={emailSending}>Cancel</button>
              <button type="submit" className="gss-email-send" disabled={emailSending}>{emailSending ? "Sending…" : "Send Report"}</button>
            </div>
          </form>
        </div>
      )}

      <footer className="bps-footer">
        <span>AIRTEL COMMUNICATIONS</span>
        <span>BRANCH PERFORMANCE REPORT</span>
        <span>{date}</span>
      </footer>
    </main>
  );
}

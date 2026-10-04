import { useEffect, useMemo, useState } from "react";
import "../cash-book-report.css";
import {
  getBranches, getCashBook, saveCashBookOpeningBalance, createCashBookEntry,
  getCashBookHistory, getCashBookExpenseCategories, getCashBookMonthlyExpenses,
  getCashBookExpenseLedger,
} from "../services/api";

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const money = (n) => `UGX ${Number(n || 0).toLocaleString("en-UG")}`;
const rawNumber = (value) => String(value ?? "").replace(/,/g, "");
const formatInput = (value) => { const raw=rawNumber(value); return /^\d*$/.test(raw)&&raw ? Number(raw).toLocaleString("en-UG") : raw === "" ? "" : value; };

export default function CashBook({ user }) {
  const [branches,setBranches]=useState([]); const [branchId,setBranchId]=useState(user?.role==="SUPERVISOR"?String(user.branch_id||""):"1");
  const [date,setDate]=useState(today); const [data,setData]=useState(null); const [history,setHistory]=useState([]);
  const [categories,setCategories]=useState([]); const [monthly,setMonthly]=useState(null); const [companyMonthly,setCompanyMonthly]=useState(null); const [reportMonth,setReportMonth]=useState(currentMonth);
  const [ledger,setLedger]=useState(null); const [ledgerScope,setLedgerScope]=useState("ALL"); const [ledgerLoading,setLedgerLoading]=useState(true);
  const [opening,setOpening]=useState(""); const [entry,setEntry]=useState({type:"EXPENSE",scope:"BRANCH",amount:"",category:"",description:""});
  const [loading,setLoading]=useState(true); const [reportLoading,setReportLoading]=useState(true); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [emailOpen,setEmailOpen]=useState(false); const [emailSending,setEmailSending]=useState(false);
  const [emailForm,setEmailForm]=useState({to:"",cc:"",subject:"",message:""});
  const allBranches=branchId==="all"; const companyView=branchId==="company"; const selectedBranch=branches.find(b=>String(b.id)===String(branchId));

  useEffect(()=>{
    if(user?.role==="SUPERVISOR"){
      setBranches([]);
      setBranchId(String(user.branch_id||""));
    } else {
      getBranches().then(rows=>{
        const list=Array.isArray(rows)?rows:[];
        setBranches(list);
        if(!list.length){setBranchId("");setLoading(false);setReportLoading(false);setLedgerLoading(false);return;}
        if(!branchId||!list.some(b=>String(b.id)===String(branchId)))setBranchId(String(list[0].id));
      }).catch(e=>setError(e?.message||"Failed to load branches."));
    }
    getCashBookExpenseCategories().then(rows=>setCategories(Array.isArray(rows)?rows:[])).catch(e=>setError(e?.message||"Failed to load expense categories.")); },[]);

  async function load(){ if(allBranches){setData(null);setHistory([]);setLoading(false);return;} setLoading(true);setError(""); try{const [current,entries]=await Promise.all([companyView?Promise.resolve(null):getCashBook(Number(branchId),date),getCashBookHistory(companyView?"company":Number(branchId))]);setData(current);setHistory(Array.isArray(entries)?entries:[]);setOpening(current?.openingBalance??"");}catch(e){setError(e?.message||"Failed to load Cash Book.");}finally{setLoading(false);} }
  async function loadMonthly(){
    if(!branchReady){setMonthly(null);setCompanyMonthly(null);setReportLoading(false);return;}
    setReportLoading(true);try{const report=await getCashBookMonthlyExpenses(branchId,reportMonth);setMonthly(report);setCompanyMonthly(null);}catch(e){setError(e?.message||"Failed to load monthly expense report.");}finally{setReportLoading(false);}
  }
  async function loadLedger(){
    if(!branchReady){setLedger(null);setLedgerLoading(false);return;}
    setLedgerLoading(true);try{setLedger(await getCashBookExpenseLedger(branchId,reportMonth,ledgerScope));}catch(e){setError(e?.message||"Failed to load expense ledger.");}finally{setLedgerLoading(false);}
  }
  const branchReady = Boolean(branchId) && (user?.role === "SUPERVISOR" || branches.length > 0);
  useEffect(()=>{if(branchReady)load();},[branchId,date,branchReady]);
  useEffect(()=>{if(branchReady)loadMonthly();},[branchId,reportMonth,branchReady]);
  useEffect(()=>{if(branchReady)loadLedger();},[branchId,reportMonth,ledgerScope,branchReady]);
  const openingLocked=useMemo(()=>Number(data?.openingBalance||0)>0||Boolean(data?.openingSetAt),[data]);
  async function saveOpening(){setBusy(true);setError("");setMessage("");try{await saveCashBookOpeningBalance(Number(branchId),Number(rawNumber(opening)||0));setMessage("Cash Book Opening Balance saved successfully.");await load();}catch(e){setError(e?.message||"Failed to save Opening Balance.");}finally{setBusy(false);}}
  function openEmailDialog(){
    const branchName=allBranches?"All Branches + Company":companyView?"Company / Central":selectedBranch?.name||user?.branch_name||"Branch";
    setEmailForm({to:"",cc:"",subject:`Cash Book Expenditure Report - ${branchName} - ${reportMonth}`,message:`Please find attached the Cash Book Expenditure Report for ${branchName} for ${reportMonth}.`});
    setError("");
    setEmailOpen(true);
  }

  async function sendReportEmail(e){
    e.preventDefault();
    setEmailSending(true);
    setError("");
    setMessage("");
    try{
      const base=import.meta.env.VITE_API_BASE_URL||"http://localhost:5000/api";
      const response=await fetch(`${base}/cash-book/monthly-expenses/email`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(localStorage.getItem("authToken")?{Authorization:`Bearer ${localStorage.getItem("authToken")}`}:{})},
        body:JSON.stringify({branchId,month:reportMonth,...emailForm})
      });
      let result=null; try{result=await response.json();}catch{}
      if(!response.ok){throw new Error(result?.error||result?.message||"Failed to email Cash Book Expenditure Report.");}
      setEmailOpen(false);
      setMessage(result?.message||"Cash Book Expenditure Report emailed successfully.");
    }catch(e){setError(e?.message||"Failed to email Cash Book Expenditure Report.");}
    finally{setEmailSending(false);}
  }

  async function saveEntry(e){e.preventDefault();setBusy(true);setError("");setMessage("");try{const effectiveScope=user?.role==="SUPERVISOR"?"BRANCH":entry.scope; const isCompany=entry.type==="EXPENSE"&&effectiveScope==="COMPANY";await createCashBookEntry({branchId:isCompany?null:Number(branchId),entryType:entry.type,expenseScope:entry.type==="EXPENSE"?effectiveScope:"BRANCH",amount:Number(rawNumber(entry.amount)||0),category:entry.type==="EXPENSE"?entry.category:null,description:String(entry.description??"").trim()||null,businessDate:date});setEntry({type:"EXPENSE",scope:"BRANCH",amount:"",category:categories[0]?.name||"",description:""});setMessage(isCompany?"Company expense recorded successfully.":entry.type==="EXPENSE"?"Expense recorded successfully.":"Funds added successfully.");await Promise.all([load(),loadMonthly(),loadLedger()]);}catch(e){setError(e?.message||"Failed to save Cash Book entry.");}finally{setBusy(false);}}

  if(!branchReady && !loading) return (
    <main className="cash-book-page">
      <header className="cash-book-header"><div><h1>Cash Book</h1><p>Expense & Cash Control</p></div></header>
      {error&&<div className="cash-book-error">{error}</div>}
      <section className="cash-book-panel cash-book-empty-state">
        <div className="cash-book-title">CASH BOOK NOT YET CONFIGURED</div>
        <div className="cash-book-empty">No branches are currently configured. Go to <strong>Master Data</strong> and add a branch before using the Cash Book.</div>
      </section>
    </main>
  );

  return <main className="cash-book-page">
    <header className="cash-book-header"><div><h1>Cash Book</h1><p>{allBranches?"All Branches + Company":companyView?"Company / Central":selectedBranch?.name||"Branch"} · Expense & Cash Control</p></div>
      <div className="cash-book-filters">{user?.role==="SUPERVISOR" ? (
        <div className="cash-book-branch-locked"><span>Branch</span><strong>{user?.branch_name || selectedBranch?.name || "Assigned Branch"}</strong></div>
      ) : (
        <label>View<select value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="all">All Branches + Company</option><option value="company">Company / Central</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      )}<label>Business Date<input type="date" max={today} value={date} onChange={e=>setDate(e.target.value)} disabled={allBranches}/></label></div>
    </header>
    {message&&<div className="cash-book-message">{message}</div>}{error&&<div className="cash-book-error">{error}</div>}
    {!allBranches&&loading?<div className="cash-book-empty">Loading Cash Book…</div>:<>
      {!allBranches&&!companyView&&<><section className="cash-book-summary"><div><span>Opening Balance</span><strong>{money(data?.openingBalance)}</strong></div><div><span>Funds Added</span><strong>{money(data?.daily?.topUps)}</strong></div><div><span>Expenses</span><strong>{money(data?.daily?.expenses)}</strong></div><div className="cash-book-closing"><span>Closing Balance</span><strong>{money(data?.totals?.closingBalance)}</strong></div></section>
      <section className="cash-book-panel"><div className="cash-book-title">OPENING BALANCE</div><div className="cash-book-opening-row"><input inputMode="numeric" value={formatInput(opening)} onChange={e=>setOpening(rawNumber(e.target.value))} disabled={openingLocked||busy} placeholder="Enter opening balance"/><button type="button" onClick={saveOpening} disabled={openingLocked||busy}>Save Opening Balance</button></div>{openingLocked&&<small>Opening Balance is locked after Cash Book transactions have been established.</small>}</section></>}
      {!allBranches&&!companyView&&<section className="cash-book-panel"><div className="cash-book-title">RECORD CASH BOOK ENTRY</div><form className="cash-book-form" onSubmit={saveEntry}><select value={entry.type} onChange={e=>setEntry({...entry,type:e.target.value,scope:"BRANCH",category:e.target.value==="EXPENSE"?(entry.category||categories[0]?.name||""):""})}><option value="EXPENSE">Expense</option><option value="TOP_UP">Funds Added</option></select>{entry.type==="EXPENSE"&&user?.role!=="SUPERVISOR"&&<select value={entry.scope} onChange={e=>setEntry({...entry,scope:e.target.value})}><option value="BRANCH">Branch Expense</option><option value="COMPANY">Company / Central</option></select>}{entry.type==="EXPENSE"&&<select required value={entry.category} onChange={e=>setEntry({...entry,category:e.target.value})}><option value="">Select Expense Category</option>{categories.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}</select>}<input inputMode="numeric" required value={formatInput(entry.amount)} onChange={e=>setEntry({...entry,amount:rawNumber(e.target.value)})} placeholder="Amount"/><input value={entry.description} onChange={e=>setEntry({...entry,description:e.target.value})} placeholder="Description (optional)"/><button disabled={busy||(!data?.openingSetAt&&entry.scope==="BRANCH")}>Record</button></form>{entry.type==="EXPENSE"&&entry.scope==="COMPANY"&&<small className="cash-book-company-note">Company / Central expenses are recorded in the central ledger and do not reduce a branch Cash Book balance.</small>}</section>}

      <section className={`cash-book-panel cash-book-company-total-panel ${user?.role==="SUPERVISOR"?"supervisor-hidden":""}`}><div className="cash-book-title">COMPANY-WIDE TOTAL EXPENDITURE — {reportMonth}</div><div className="cash-book-company-total-body"><div><span>All Branch Expenses</span><strong>{money(companyMonthly?.summary?.branchExpenses)}</strong></div><div><span>Company / Central</span><strong>{money(companyMonthly?.summary?.companyExpenses)}</strong></div><div className="cash-book-combined"><span>COMBINED TOTAL EXPENDITURE</span><strong>{money(companyMonthly?.summary?.combinedExpenses)}</strong></div></div><small>This is the combined expenditure of every branch plus all Company / Central expenses for the selected month.</small></section>

      <section className="cash-book-panel cash-book-ledger-panel"><div className="cash-book-title">EXPENSE LEDGER — {allBranches?"ALL BRANCHES + COMPANY":companyView?"COMPANY / CENTRAL":selectedBranch?.name||"BRANCH"}</div><div className="cash-book-ledger-controls"><label>Ledger Month<input type="month" max={currentMonth} value={reportMonth} onChange={e=>setReportMonth(e.target.value)}/></label><label>Scope<select value={ledgerScope} onChange={e=>setLedgerScope(e.target.value)}><option value="ALL">All Expenses</option><option value="BRANCH">Branch Expenses</option><option value="COMPANY">Company / Central</option></select></label></div>{ledgerLoading?<div className="cash-book-empty">Loading expense ledger…</div>:<><div className="cash-book-ledger-summary"><div><span>Entries</span><strong>{ledger?.summary?.entries||0}</strong></div><div><span>Branch Expenses</span><strong>{money(ledger?.summary?.branchAmount)}</strong></div><div><span>Company / Central</span><strong>{money(ledger?.summary?.companyAmount)}</strong></div><div className="cash-book-combined"><span>Ledger Total</span><strong>{money(ledger?.summary?.amount)}</strong></div></div><div className="cash-book-table cash-book-expense-ledger"><div className="cash-book-row cash-book-head"><span>Date</span><span>Scope / Branch</span><span>Category</span><span>Description</span><span>Amount</span></div>{ledger?.entries?.map(x=><div className="cash-book-row" key={x.id}><span>{x.businessDate}</span><span>{x.expenseScope==="COMPANY"?"Company / Central":x.branchName||"Branch"}</span><span>{x.category||"Other"}</span><span>{x.description||"—"}</span><strong>{money(x.amount)}</strong></div>)}{!ledger?.entries?.length&&<div className="cash-book-empty">No expenses recorded for the selected month and scope.</div>}</div></>}</section>

      <section className="cash-book-report-document">
        <header className="cash-book-report-header">
          <div className="cash-book-report-heading">
            <div className="cash-book-report-company">AIRTEL COMMUNICATIONS</div>
            <h2>{String(allBranches ? "ALL BRANCHES + COMPANY" : companyView ? "COMPANY / CENTRAL" : selectedBranch?.name || "BRANCH").toUpperCase()} CASH BOOK EXPENDITURE REPORT</h2>
            <p>Monthly expenditure and cash control statement</p>
          </div>
          <div className="cash-book-report-actions">
            <button type="button" onClick={()=>window.print()}>Print PDF</button>
            <button type="button" onClick={openEmailDialog} disabled={reportLoading||!monthly}>Email Report</button>
          </div>
        </header>

        <div className="cash-book-report-meta">
          <div><span>REPORTING MONTH</span><strong>{reportMonth}</strong></div>
          <div><span>BRANCH / SCOPE</span><strong>{allBranches?"ALL BRANCHES + COMPANY":companyView?"COMPANY / CENTRAL":selectedBranch?.name||"BRANCH"}</strong></div>
          <div><span>REPORT TYPE</span><strong>MONTHLY EXPENDITURE</strong></div>
        </div>

        <div className="cash-book-report-status">MONTHLY EXPENDITURE REPORT <span>READ-ONLY REPORT</span></div>

        {reportLoading ? <div className="cash-book-empty">Loading monthly report…</div> : <>
          <section className="cash-book-report-section">
            <div className="cash-book-report-section-title">MONTHLY CASH BOOK POSITION</div>
            <div className="cash-book-report-statement">
              <div className="cash-book-report-line cash-book-report-column-head"><span>POSITION</span><span>AMOUNT</span></div>
              <div className="cash-book-report-line"><span>Funds Added</span><strong>{money(monthly?.summary?.fundsAdded)}</strong></div>
              <div className="cash-book-report-line"><span>Branch Expenses</span><strong>{money(monthly?.summary?.branchExpenses)}</strong></div>
              <div className="cash-book-report-line"><span>Company / Central Expenses</span><strong>{money(monthly?.summary?.companyExpenses)}</strong></div>
              <div className="cash-book-report-line cash-book-report-subtotal"><span>Combined Expenditure</span><strong>{money(monthly?.summary?.combinedExpenses)}</strong></div>
              <div className="cash-book-report-line cash-book-report-emphasis"><span>Net Movement</span><strong>{money(monthly?.summary?.netMovement)}</strong></div>
            </div>
          </section>

          <section className="cash-book-report-section">
            <div className="cash-book-report-section-title">KEY BRANCH EXPENSE FINDINGS</div>
            <div className="cash-book-report-statement">
              <div className="cash-book-report-line cash-book-report-column-head"><span>FINDING</span><span>RESULT</span></div>
              <div className="cash-book-report-line cash-book-report-finding">
                <span>Highest Branch Expense by Amount</span>
                <strong>{monthly?.highlights?.highestBranchExpense ? `${monthly.highlights.highestBranchExpense.category} · ${money(monthly.highlights.highestBranchExpense.amount)} · ${monthly.highlights.highestBranchExpense.entries} entries` : "No branch expense recorded"}</strong>
              </div>
              <div className="cash-book-report-line cash-book-report-finding">
                <span>Most Frequent Branch Expense</span>
                <strong>{monthly?.highlights?.mostFrequentBranchExpense ? `${monthly.highlights.mostFrequentBranchExpense.category} · ${monthly.highlights.mostFrequentBranchExpense.entries} entries · ${money(monthly.highlights.mostFrequentBranchExpense.amount)}` : "No branch expense recorded"}</strong>
              </div>
            </div>
          </section>

          {allBranches && <section className="cash-book-report-section">
            <div className="cash-book-report-section-title">EXPENSES BY BRANCH</div>
            <div className="cash-book-report-table">
              <div className="cash-book-report-table-row cash-book-report-table-head"><span>BRANCH</span><span>ENTRIES</span><span>EXPENDITURE</span></div>
              {monthly?.branches?.map(x=><div className="cash-book-report-table-row" key={x.id||x.name}><span>{x.name}</span><span>{x.entries}</span><strong>{money(x.expenses)}</strong></div>)}
              {monthly?.company&&<div className="cash-book-report-table-row cash-book-report-total"><span>Company / Central</span><span>{monthly.company.entries}</span><strong>{money(monthly.company.amount)}</strong></div>}
            </div>
          </section>}

          <section className="cash-book-report-section">
            <div className="cash-book-report-section-title">EXPENSE BY CATEGORY</div>
            <div className="cash-book-report-table">
              <div className="cash-book-report-table-row cash-book-report-table-head"><span>CATEGORY</span><span>ENTRIES</span><span>AMOUNT</span></div>
              {monthly?.categories?.map(x=><div className="cash-book-report-table-row" key={x.category}><span>{x.category}</span><span>{x.entries}</span><strong>{money(x.amount)}</strong></div>)}
              {!monthly?.categories?.length&&<div className="cash-book-empty">No expenses recorded for this month.</div>}
            </div>
          </section>

          <section className="cash-book-report-section">
            <div className="cash-book-report-section-title">DAILY EXPENDITURE</div>
            <div className="cash-book-report-table">
              <div className="cash-book-report-table-row cash-book-report-table-head"><span>DATE</span><span>ENTRIES</span><span>DAILY TOTAL</span></div>
              {monthly?.daily?.map(x=><div className="cash-book-report-table-row" key={x.businessDate}><span>{x.businessDate}</span><span>{x.entries}</span><strong>{money(x.amount)}</strong></div>)}
            </div>
          </section>

          <section className="cash-book-report-section">
            <div className="cash-book-report-section-title">DETAILED EXPENDITURE</div>
            <div className="cash-book-report-table cash-book-report-detail-table">
              <div className="cash-book-report-table-row cash-book-report-table-head"><span>DATE</span><span>SCOPE / BRANCH</span><span>CATEGORY</span><span>DESCRIPTION</span><span>AMOUNT</span></div>
              {monthly?.entries?.map((x,i)=><div className="cash-book-report-table-row" key={`${x.businessDate}-${x.category}-${i}`}><span>{x.businessDate}</span><span>{x.expenseScope==="COMPANY"?"Company / Central":x.branchName||"Branch"}</span><span>{x.category||"Other"}</span><span>{x.description||"—"}</span><strong>{money(x.amount)}</strong></div>)}
              {!monthly?.entries?.length&&<div className="cash-book-empty">No expenditure entries recorded for this month.</div>}
            </div>
          </section>

          <footer className="cash-book-report-footer">
            <span>AIRTEL COMMUNICATIONS</span>
            <span>CASH BOOK EXPENDITURE REPORT</span>
            <span>{reportMonth}</span>
          </footer>
        </>}
      </section>

      {!allBranches&&!companyView&&<section className="cash-book-panel"><div className="cash-book-title">TODAY'S CASH BOOK ENTRIES</div><div className="cash-book-table"><div className="cash-book-row cash-book-head"><span>Date / Time</span><span>Type / Category</span><span>Description</span><span>Amount</span></div>{history.map(x=><div className="cash-book-row" key={x.id}><span>{new Date(x.entered_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span><span>{x.entry_type==="EXPENSE"?x.category||"Expense":"Funds Added"}</span><span>{x.description||"—"}</span><strong>{money(x.amount)}</strong></div>)}{!history.length&&<div className="cash-book-empty">No Cash Book history yet.</div>}</div></section>}
    </>}
    {emailOpen&&<div className="cash-book-email-overlay" role="dialog" aria-modal="true" aria-labelledby="cash-book-email-title">
      <form className="cash-book-email-dialog" onSubmit={sendReportEmail}>
        <div className="cash-book-email-header">
          <div><h2 id="cash-book-email-title">Email Cash Book Expenditure Report</h2><p>{allBranches?"All Branches + Company":companyView?"Company / Central":selectedBranch?.name||user?.branch_name||"Branch"} • {reportMonth}</p></div>
          <button type="button" className="cash-book-email-close" onClick={()=>setEmailOpen(false)} aria-label="Close">×</button>
        </div>
        <div className="cash-book-email-field"><label htmlFor="cash-book-email-to">To</label><div className="cash-book-email-help">Separate multiple addresses with commas</div><input id="cash-book-email-to" required value={emailForm.to} onChange={e=>setEmailForm(v=>({...v,to:e.target.value}))} placeholder="recipient@example.com" autoFocus /></div>
        <div className="cash-book-email-field"><label htmlFor="cash-book-email-cc">CC <span>Optional</span></label><input id="cash-book-email-cc" value={emailForm.cc} onChange={e=>setEmailForm(v=>({...v,cc:e.target.value}))} placeholder="cc@example.com" /></div>
        <div className="cash-book-email-field"><label htmlFor="cash-book-email-subject">Subject</label><input id="cash-book-email-subject" required value={emailForm.subject} onChange={e=>setEmailForm(v=>({...v,subject:e.target.value}))} /></div>
        <div className="cash-book-email-field"><label htmlFor="cash-book-email-message">Message</label><textarea id="cash-book-email-message" rows="5" value={emailForm.message} onChange={e=>setEmailForm(v=>({...v,message:e.target.value}))} /></div>
        <div className="cash-book-email-actions"><button type="button" onClick={()=>setEmailOpen(false)} disabled={emailSending}>Cancel</button><button type="submit" disabled={emailSending}>{emailSending?"Sending…":"Send Report"}</button></div>
      </form>
    </div>}
  </main>;
}

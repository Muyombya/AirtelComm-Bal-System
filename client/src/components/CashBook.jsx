import { useEffect, useMemo, useState } from "react";
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

      <section className="cash-book-panel"><div className="cash-book-title">MONTHLY EXPENSE RECONCILIATION</div><div className="cash-book-report-controls"><label>Month<input type="month" max={currentMonth} value={reportMonth} onChange={e=>setReportMonth(e.target.value)}/></label></div>{reportLoading?<div className="cash-book-empty">Loading monthly report…</div>:<>
        <div className="cash-book-month-summary"><div><span>Branch Expenses</span><strong>{money(monthly?.summary?.branchExpenses)}</strong></div><div><span>Company / Central</span><strong>{money(monthly?.summary?.companyExpenses)}</strong></div><div className="cash-book-combined"><span>Combined Expenses</span><strong>{money(monthly?.summary?.combinedExpenses)}</strong></div></div>
        {monthly?.highlights?.mostFrequentBranchExpense&&<div className="cash-book-highlight"><strong>Most Frequent Branch Expense:</strong> {monthly.highlights.mostFrequentBranchExpense.category} · {monthly.highlights.mostFrequentBranchExpense.entries} entries · {money(monthly.highlights.mostFrequentBranchExpense.amount)}</div>}
        {monthly?.highlights?.highestBranchExpense&&<div className="cash-book-highlight"><strong>Highest Branch Expense by Amount:</strong> {monthly.highlights.highestBranchExpense.category} · {money(monthly.highlights.highestBranchExpense.amount)} · {monthly.highlights.highestBranchExpense.entries} entries</div>}
        {(allBranches)&&<><div className="cash-book-subtitle">EXPENSES BY BRANCH</div><div className="cash-book-table"><div className="cash-book-row cash-book-head cash-book-branch-row"><span>Branch</span><span>Entries</span><span>Monthly Expenses</span></div>{monthly?.branches?.map(x=><div className="cash-book-row cash-book-branch-row" key={x.id}><span>{x.name}</span><span>{x.entries}</span><strong>{money(x.expenses)}</strong></div>)}{monthly?.company&&<div className="cash-book-row cash-book-branch-row cash-book-company-row"><span>Company / Central</span><span>{monthly.company.entries}</span><strong>{money(monthly.company.amount)}</strong></div>}</div></>}
        <div className="cash-book-subtitle">EXPENSE BY CATEGORY</div><div className="cash-book-table cash-book-category-table"><div className="cash-book-row cash-book-head"><span>Category</span><span>Entries</span><span>Amount</span></div>{monthly?.categories?.map(x=><div className="cash-book-row" key={x.category}><span>{x.category}</span><span>{x.entries}</span><strong>{money(x.amount)}</strong></div>)}{!monthly?.categories?.length&&<div className="cash-book-empty">No expenses recorded for this month.</div>}</div>
        <div className="cash-book-subtitle">DAILY EXPENSES</div><div className="cash-book-table cash-book-daily-table"><div className="cash-book-row cash-book-head"><span>Date</span><span>Entries</span><span>Daily Total</span></div>{monthly?.daily?.map(x=><div className="cash-book-row" key={x.businessDate}><span>{x.businessDate}</span><span>{x.entries}</span><strong>{money(x.amount)}</strong></div>)}</div>
      </>}</section>
      {!allBranches&&!companyView&&<section className="cash-book-panel"><div className="cash-book-title">TODAY'S CASH BOOK ENTRIES</div><div className="cash-book-table"><div className="cash-book-row cash-book-head"><span>Date / Time</span><span>Type / Category</span><span>Description</span><span>Amount</span></div>{history.map(x=><div className="cash-book-row" key={x.id}><span>{new Date(x.entered_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span><span>{x.entry_type==="EXPENSE"?x.category||"Expense":"Funds Added"}</span><span>{x.description||"—"}</span><strong>{money(x.amount)}</strong></div>)}{!history.length&&<div className="cash-book-empty">No Cash Book history yet.</div>}</div></section>}
    </>}
  </main>;
}

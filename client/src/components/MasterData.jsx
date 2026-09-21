import { useEffect, useMemo, useState } from "react";
import "../master-data.css";
import {
  getBranches, createBranch, updateBranch, getMasterTills, createMasterTill, updateMasterTill,
  getEmployees, createEmployee, updateEmployee, getMasterServiceProviders, createServiceProvider,
  updateServiceProvider, setTillAssignment
} from "../services/api";

const money = n => Number(n || 0).toLocaleString("en-UG");
const emptyBranch = {name:"",location:"",contact:"",email:"",operatingCapital:""};
const emptyTill = {branchId:"",name:"",operatingCapital:"",status:"ACTIVE"};
const emptyEmployee = {name:"",contact:""};
const emptyProvider = {name:"",serviceName:"",status:"ACTIVE"};

export default function MasterData(){
  const [tab,setTab]=useState("branches"); const [branches,setBranches]=useState([]); const [tills,setTills]=useState([]); const [employees,setEmployees]=useState([]); const [providers,setProviders]=useState([]);
  const [branchForm,setBranchForm]=useState(emptyBranch); const [tillForm,setTillForm]=useState(emptyTill); const [employeeForm,setEmployeeForm]=useState(emptyEmployee); const [providerForm,setProviderForm]=useState(emptyProvider);
  const [editBranch,setEditBranch]=useState(null),[editTill,setEditTill]=useState(null),[editEmployee,setEditEmployee]=useState(null),[editProvider,setEditProvider]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function loadAll(){setError("");try{const [b,t,e,p]=await Promise.all([getBranches(),getMasterTills(),getEmployees(),getMasterServiceProviders()]);setBranches(b||[]);setTills(t||[]);setEmployees(e||[]);setProviders(p||[]);}catch(e){setError(e?.message||"Failed to load master data.");}}
  useEffect(()=>{loadAll();},[]);
  const activeBranches=useMemo(()=>branches,[branches]);
  const businessCapital=useMemo(
    ()=>branches.reduce((total,branch)=>total+Number(branch.operating_capital||0),0),
    [branches]
  );

  function resetForms(){setBranchForm(emptyBranch);setTillForm({ ...emptyTill, branchId:activeBranches[0]?.id?String(activeBranches[0].id):""});setEmployeeForm(emptyEmployee);setProviderForm(emptyProvider);setEditBranch(null);setEditTill(null);setEditEmployee(null);setEditProvider(null);}
  useEffect(()=>{if(!tillForm.branchId&&activeBranches[0])setTillForm(v=>({...v,branchId:String(activeBranches[0].id)}));},[activeBranches.length]);

  async function save(fn){setBusy(true);setError("");setMessage("");try{await fn();await loadAll();setMessage("Master data saved successfully.");}catch(e){setError(e?.message||"Could not save.");}finally{setBusy(false);}}

  return <main className="app-shell master-data-page">
    <header className="master-header"><div><h1>MASTER DATA & SETUP</h1><p>Branches, Tills, Operating Capital, Employees and Service Providers</p></div></header>
    <section className="business-capital-summary" aria-label="Business Capital Summary">
      <div className="business-capital-card business-capital-primary">
        <div className="business-capital-card-top">
          <div>
            <span className="business-capital-label">BUSINESS CAPITAL</span>
            <small className="business-capital-subtitle">Total operating capital across all branches</small>
          </div>
          <span className="business-capital-badge">COMPANY TOTAL</span>
        </div>
        <strong>UGX {money(businessCapital)}</strong>
      </div>
      <div className="business-capital-card business-capital-count">
        <span className="business-capital-label">BRANCHES</span>
        <strong>{branches.length.toLocaleString("en-UG")}</strong>
        <small className="business-capital-subtitle">Configured branches</small>
      </div>
    </section>
    {error&&<div className="master-alert error">{error}</div>}{message&&<div className="master-alert success">{message}</div>}
    <div className="master-tabs">{[["branches","Branches"],["tills","Tills"],["employees","Employees"],["providers","Service Providers"]].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>{setTab(id);setError("");setMessage("");}}>{label}</button>)}</div>

    {tab==="branches"&&<section className="master-section"><FormTitle title={editBranch?"EDIT BRANCH":"ADD BRANCH"} onCancel={editBranch?resetForms:null}/><form className="master-form" onSubmit={e=>{e.preventDefault();save(async()=>{const p={...branchForm,operatingCapital:Number(String(branchForm.operatingCapital||0).replace(/,/g,""))};if(editBranch)await updateBranch(editBranch,p);else await createBranch(p);resetForms();});}}><Field label="Branch Name"><input required value={branchForm.name} onChange={e=>setBranchForm({...branchForm,name:e.target.value})}/></Field><Field label="Location"><input value={branchForm.location} onChange={e=>setBranchForm({...branchForm,location:e.target.value})}/></Field><Field label="Contact"><input value={branchForm.contact} onChange={e=>setBranchForm({...branchForm,contact:e.target.value})}/></Field><Field label="Email"><input type="email" value={branchForm.email} onChange={e=>setBranchForm({...branchForm,email:e.target.value})}/></Field><Field label="Branch Operating Capital"><input inputMode="numeric" value={branchForm.operatingCapital} onChange={e=>setBranchForm({...branchForm,operatingCapital:e.target.value.replace(/[^0-9,]/g,"")})}/></Field><button className="master-primary" disabled={busy}>{editBranch?"Update Branch":"Add Branch"}</button></form><DataTable headers={["Branch","Location","Operating Capital","Action"]} rows={branches.map(b=><tr key={b.id}><td>{b.name}</td><td>{b.location||"—"}</td><td>UGX {money(b.operating_capital)}</td><td><button className="master-link" onClick={()=>{setEditBranch(b.id);setBranchForm({name:b.name,location:b.location||"",contact:b.contact||"",email:b.email||"",operatingCapital:money(b.operating_capital)})}}>Edit</button></td></tr>)}/></section>}

    {tab==="tills"&&<section className="master-section"><FormTitle title={editTill?"EDIT TILL":"ADD TILL"} onCancel={editTill?resetForms:null}/><form className="master-form" onSubmit={e=>{e.preventDefault();save(async()=>{const p={...tillForm,operatingCapital:Number(String(tillForm.operatingCapital||0).replace(/,/g,""))};if(editTill)await updateMasterTill(editTill,p);else await createMasterTill(p);resetForms();});}}><Field label="Branch"><select required value={tillForm.branchId} onChange={e=>setTillForm({...tillForm,branchId:e.target.value})}>{activeBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Till Name"><input required value={tillForm.name} onChange={e=>setTillForm({...tillForm,name:e.target.value})}/></Field><Field label="Operating Capital"><input required inputMode="numeric" value={tillForm.operatingCapital} onChange={e=>setTillForm({...tillForm,operatingCapital:e.target.value.replace(/[^0-9,]/g,"")})}/></Field><Field label="Status"><select value={tillForm.status} onChange={e=>setTillForm({...tillForm,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></Field><button className="master-primary" disabled={busy}>{editTill?"Update Till":"Add Till"}</button></form><DataTable headers={["Branch","Till","Operating Capital","Attendant","Status","Action"]} rows={tills.map(t=><tr key={t.id}><td>{t.branch_name}</td><td>{t.name}</td><td>UGX {money(t.operating_capital)}</td><td><select className="inline-select" value={t.employee_id||""} onChange={e=>save(async()=>{await setTillAssignment(t.id,e.target.value||null);})}><option value="">Unassigned</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></td><td><span className={`master-status ${String(t.status).toLowerCase()}`}>{t.status}</span></td><td><button className="master-link" onClick={()=>{setEditTill(t.id);setTillForm({branchId:String(t.branch_id),name:t.name,operatingCapital:money(t.operating_capital),status:t.status})}}>Edit</button></td></tr>)}/></section>}

    {tab==="employees"&&<section className="master-section"><FormTitle title={editEmployee?"EDIT EMPLOYEE":"ADD EMPLOYEE"} onCancel={editEmployee?resetForms:null}/><form className="master-form compact" onSubmit={e=>{e.preventDefault();save(async()=>{if(editEmployee)await updateEmployee(editEmployee,employeeForm);else await createEmployee(employeeForm);resetForms();});}}><Field label="Employee Name"><input required value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})}/></Field><Field label="Contact"><input value={employeeForm.contact} onChange={e=>setEmployeeForm({...employeeForm,contact:e.target.value})}/></Field><button className="master-primary" disabled={busy}>{editEmployee?"Update Employee":"Add Employee"}</button></form><DataTable headers={["Employee","Contact","Action"]} rows={employees.map(e=><tr key={e.id}><td>{e.name}</td><td>{e.contact||"—"}</td><td><button className="master-link" onClick={()=>{setEditEmployee(e.id);setEmployeeForm({name:e.name,contact:e.contact||""})}}>Edit</button></td></tr>)}/></section>}

    {tab==="providers"&&<section className="master-section"><FormTitle title={editProvider?"EDIT SERVICE PROVIDER":"ADD SERVICE PROVIDER"} onCancel={editProvider?resetForms:null}/><form className="master-form" onSubmit={e=>{e.preventDefault();save(async()=>{if(editProvider)await updateServiceProvider(editProvider,providerForm);else await createServiceProvider(providerForm);resetForms();});}}><Field label="Provider Name"><input required value={providerForm.name} onChange={e=>setProviderForm({...providerForm,name:e.target.value})}/></Field><Field label="Service"><input value={providerForm.serviceName} onChange={e=>setProviderForm({...providerForm,serviceName:e.target.value})}/></Field><Field label="Status"><select value={providerForm.status} onChange={e=>setProviderForm({...providerForm,status:e.target.value})}><option>ACTIVE</option><option>INACTIVE</option></select></Field><button className="master-primary" disabled={busy}>{editProvider?"Update Provider":"Add Provider"}</button></form><DataTable headers={["Provider","Service","Status","Action"]} rows={providers.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.service_name||"—"}</td><td><span className={`master-status ${String(p.status).toLowerCase()}`}>{p.status}</span></td><td><button className="master-link" onClick={()=>{setEditProvider(p.id);setProviderForm({name:p.name,serviceName:p.service_name||"",status:p.status})}}>Edit</button></td></tr>)}/></section>}
  </main>
}
function FormTitle({title,onCancel}){return <div className="master-form-title"><h2>{title}</h2>{onCancel&&<button type="button" className="master-cancel" onClick={onCancel}>Cancel</button>}</div>}
function Field({label,children}){return <label className="master-field"><span>{label}</span>{children}</label>}
function DataTable({headers,rows}){return <div className="master-table-wrap"><table className="master-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows:<tr><td colSpan={headers.length}>No records.</td></tr>}</tbody></table></div>}

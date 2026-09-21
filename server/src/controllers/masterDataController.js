import { pool } from "../config/database.js";

const toNumber = (v) => Number(v || 0);

export async function createBranch(req, res, next) {
  try {
    const { name, contact = null, email = null, location = null, operatingCapital = 0 } = req.body || {};
    if (!String(name || "").trim()) return res.status(400).json({ error: "Branch name is required." });
    const result = await pool.query(
      `INSERT INTO branches (name, contact, email, location, operating_capital)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,name,contact,email,location,operating_capital`,
      [String(name).trim(), contact || null, email || null, location || null, toNumber(operatingCapital)]
    );
    res.status(201).json({ ...result.rows[0], id: Number(result.rows[0].id), operating_capital: toNumber(result.rows[0].operating_capital) });
  } catch (e) { next(e); }
}

export async function updateBranch(req, res, next) {
  try {
    const { id } = req.params;
    const { name, contact = null, email = null, location = null, operatingCapital = 0 } = req.body || {};
    if (!String(name || "").trim()) return res.status(400).json({ error: "Branch name is required." });
    const result = await pool.query(
      `UPDATE branches SET name=$1, contact=$2, email=$3, location=$4, operating_capital=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id,name,contact,email,location,operating_capital`,
      [String(name).trim(), contact || null, email || null, location || null, toNumber(operatingCapital), Number(id)]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Branch not found." });
    res.json({ ...result.rows[0], id: Number(result.rows[0].id), operating_capital: toNumber(result.rows[0].operating_capital) });
  } catch (e) { next(e); }
}

export async function listMasterTills(req, res, next) {
  try {
    const params = [];
    let where = "";
    if (req.query.branchId) { params.push(Number(req.query.branchId)); where = "WHERE t.branch_id=$1"; }
    const result = await pool.query(
      `SELECT t.id,t.branch_id,t.name,t.operating_capital,t.status,b.name AS branch_name,
              e.id AS employee_id,e.name AS employee_name
         FROM tills t
         JOIN branches b ON b.id=t.branch_id
         LEFT JOIN LATERAL (
           SELECT e.id,e.name FROM till_assignments ta JOIN employees e ON e.id=ta.employee_id
           WHERE ta.till_id=t.id AND ta.ended_at IS NULL ORDER BY ta.started_at DESC, ta.id DESC LIMIT 1
         ) e ON TRUE
         ${where} ORDER BY b.name,t.name,t.id`, params);
    res.json(result.rows.map(r => ({ ...r, id:Number(r.id), branch_id:Number(r.branch_id), operating_capital:toNumber(r.operating_capital), employee_id:r.employee_id?Number(r.employee_id):null })));
  } catch(e){ next(e); }
}

export async function createTill(req,res,next){
  try{
    const { branchId,name,operatingCapital=0,status="ACTIVE" }=req.body||{};
    if(!branchId || !String(name||"").trim()) return res.status(400).json({error:"Branch and Till name are required."});
    const branch=await pool.query("SELECT id FROM branches WHERE id=$1",[Number(branchId)]);
    if(!branch.rowCount) return res.status(400).json({error:"Selected branch does not exist."});
    const result=await pool.query(`INSERT INTO tills(branch_id,name,operating_capital,status) VALUES($1,$2,$3,$4) RETURNING id,branch_id,name,operating_capital,status`,[Number(branchId),String(name).trim(),toNumber(operatingCapital),status]);
    res.status(201).json({...result.rows[0],id:Number(result.rows[0].id),branch_id:Number(result.rows[0].branch_id),operating_capital:toNumber(result.rows[0].operating_capital)});
  }catch(e){next(e);}
}

export async function updateTill(req,res,next){
  try{
    const {id}=req.params; const {branchId,name,operatingCapital=0,status="ACTIVE"}=req.body||{};
    if(!branchId || !String(name||"").trim()) return res.status(400).json({error:"Branch and Till name are required."});
    const result=await pool.query(`UPDATE tills SET branch_id=$1,name=$2,operating_capital=$3,status=$4,updated_at=NOW() WHERE id=$5 RETURNING id,branch_id,name,operating_capital,status`,[Number(branchId),String(name).trim(),toNumber(operatingCapital),status,Number(id)]);
    if(!result.rowCount)return res.status(404).json({error:"Till not found."});
    res.json({...result.rows[0],id:Number(result.rows[0].id),branch_id:Number(result.rows[0].branch_id),operating_capital:toNumber(result.rows[0].operating_capital)});
  }catch(e){next(e);}
}

export async function listEmployees(req,res,next){
  try{const r=await pool.query(`SELECT id,name,contact FROM employees ORDER BY name,id`);res.json(r.rows.map(x=>({...x,id:Number(x.id)})));}catch(e){next(e);}
}
export async function createEmployee(req,res,next){
  try{const {name,contact=null}=req.body||{};if(!String(name||"").trim())return res.status(400).json({error:"Employee name is required."});const r=await pool.query(`INSERT INTO employees(name,contact) VALUES($1,$2) RETURNING id,name,contact`,[String(name).trim(),contact||null]);res.status(201).json({...r.rows[0],id:Number(r.rows[0].id)});}catch(e){next(e);}
}
export async function updateEmployee(req,res,next){
  try{const {id}=req.params;const {name,contact=null}=req.body||{};if(!String(name||"").trim())return res.status(400).json({error:"Employee name is required."});const r=await pool.query(`UPDATE employees SET name=$1,contact=$2,updated_at=NOW() WHERE id=$3 RETURNING id,name,contact`,[String(name).trim(),contact||null,Number(id)]);if(!r.rowCount)return res.status(404).json({error:"Employee not found."});res.json({...r.rows[0],id:Number(r.rows[0].id)});}catch(e){next(e);}
}

export async function listProviders(req,res,next){
  try{const r=await pool.query(`SELECT id,name,service_name,status FROM service_providers ORDER BY name,id`);res.json(r.rows.map(x=>({...x,id:Number(x.id)})));}catch(e){next(e);}
}
export async function createProvider(req,res,next){
  try{const {name,serviceName=null,status="ACTIVE"}=req.body||{};if(!String(name||"").trim())return res.status(400).json({error:"Service provider name is required."});const r=await pool.query(`INSERT INTO service_providers(name,service_name,status) VALUES($1,$2,$3) RETURNING id,name,service_name,status`,[String(name).trim(),serviceName||null,status]);res.status(201).json({...r.rows[0],id:Number(r.rows[0].id)});}catch(e){next(e);}
}
export async function updateProvider(req,res,next){
  try{const {id}=req.params;const {name,serviceName=null,status="ACTIVE"}=req.body||{};if(!String(name||"").trim())return res.status(400).json({error:"Service provider name is required."});const r=await pool.query(`UPDATE service_providers SET name=$1,service_name=$2,status=$3,updated_at=NOW() WHERE id=$4 RETURNING id,name,service_name,status`,[String(name).trim(),serviceName||null,status,Number(id)]);if(!r.rowCount)return res.status(404).json({error:"Service provider not found."});res.json({...r.rows[0],id:Number(r.rows[0].id)});}catch(e){next(e);}
}

export async function getTillAssignment(req,res,next){
  try{const r=await pool.query(`SELECT ta.id,ta.till_id,ta.employee_id,ta.started_at,e.name AS employee_name FROM till_assignments ta JOIN employees e ON e.id=ta.employee_id WHERE ta.till_id=$1 AND ta.ended_at IS NULL ORDER BY ta.started_at DESC,ta.id DESC LIMIT 1`,[Number(req.params.tillId)]);res.json(r.rows[0]?{...r.rows[0],id:Number(r.rows[0].id),till_id:Number(r.rows[0].till_id),employee_id:Number(r.rows[0].employee_id)}:null);}catch(e){next(e);}
}

export async function setTillAssignment(req,res,next){
  const client=await pool.connect();
  try{
    const tillId=Number(req.params.tillId); const employeeId=req.body?.employeeId ? Number(req.body.employeeId) : null;
    await client.query("BEGIN");
    const till=await client.query("SELECT id FROM tills WHERE id=$1 AND status='ACTIVE' FOR UPDATE",[tillId]);
    if(!till.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"Active Till not found."});}
    await client.query("UPDATE till_assignments SET ended_at=NOW() WHERE till_id=$1 AND ended_at IS NULL",[tillId]);
    if(employeeId){
      const employee=await client.query("SELECT id FROM employees WHERE id=$1",[employeeId]);
      if(!employee.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"Employee not found."});}
      await client.query("UPDATE till_assignments SET ended_at=NOW() WHERE employee_id=$1 AND ended_at IS NULL",[employeeId]);
      await client.query("INSERT INTO till_assignments(till_id,employee_id) VALUES($1,$2)",[tillId,employeeId]);
    }
    await client.query("COMMIT");
    res.json({success:true});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
}

import crypto from "crypto";
import { pool } from "../config/database.js";

const TOKEN_TTL_HOURS = 24;
const PASSWORD_MIN_LENGTH = 8;
const INITIAL_SALT = 'AirtelComm-026-Initial-Salt';
const INITIAL_HASH = "3389e46ec8449160bfae02a8a61d0bffa8aacceeffabff2367830d57a2b1d51b49c365862c2fbc951768bb28a0bc9fd9738a0db0293f65aa44c8c33eb365b775";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return { salt, hash };
}
function verifyPassword(password, salt, expectedHash) {
  if (typeof salt !== "string" || !salt || typeof expectedHash !== "string" || !/^[0-9a-f]+$/i.test(expectedHash) || expectedHash.length !== 128) return false;
  const actual = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual,"hex"), Buffer.from(expectedHash,"hex"));
}
function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
function publicUser(row) { return { id:Number(row.id), username:row.username, role:row.role, branch_id:row.branch_id ? Number(row.branch_id) : null, branch_name:row.branch_name || null, till_id:row.till_id ? Number(row.till_id) : null, till_name:row.till_name || null, must_change_password:Boolean(row.must_change_password), status:row.status }; }

export async function ensureInitialManager() {
  const existing = await pool.query("SELECT id, password_salt, password_hash, role, branch_id, status FROM app_users WHERE LOWER(username) = 'manager' LIMIT 1");
  if (!existing.rowCount) {
    await pool.query(`INSERT INTO app_users(username,password_salt,password_hash,role,branch_id,must_change_password,status) VALUES($1,$2,$3,'MANAGER',NULL,TRUE,'ACTIVE')`, ["manager", INITIAL_SALT, INITIAL_HASH]);
    return;
  }

  const manager = existing.rows[0];
  if (typeof manager.password_salt !== "string" || !manager.password_salt || typeof manager.password_hash !== "string" || !manager.password_hash) {
    await pool.query(
      `UPDATE app_users SET password_salt=$1, password_hash=$2, role='MANAGER', branch_id=NULL, must_change_password=TRUE, status='ACTIVE', updated_at=NOW() WHERE id=$3`,
      [INITIAL_SALT, INITIAL_HASH, manager.id]
    );
  }
}

export async function login(req,res,next) {
  try {
    const username=String(req.body?.username||"").trim().toLowerCase();
    const password=String(req.body?.password||"");
    if(!username||!password) return res.status(400).json({error:"Username and password are required."});
    const r=await pool.query(`SELECT u.*, b.name AS branch_name FROM app_users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN tills t ON t.id=u.till_id WHERE LOWER(u.username)=LOWER($1) LIMIT 1`,[username]);
    if(!r.rowCount || r.rows[0].status!=="ACTIVE" || !verifyPassword(password,r.rows[0].password_salt,r.rows[0].password_hash)) return res.status(401).json({error:"Invalid username or password."});
    const token=crypto.randomBytes(32).toString("hex");
    const expires=new Date(Date.now()+TOKEN_TTL_HOURS*3600*1000);
    await pool.query("INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",[r.rows[0].id,hashToken(token),expires]);
    await pool.query("UPDATE app_users SET last_login_at=NOW() WHERE id=$1",[r.rows[0].id]);
    res.json({token,expiresAt:expires.toISOString(),user:publicUser(r.rows[0])});
  } catch(e) { next(e); }
}
export async function logout(req,res,next) { try { if(req.authToken) await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1",[hashToken(req.authToken)]); res.json({success:true}); } catch(e){next(e);} }
export async function me(req,res) { res.json({user:publicUser(req.user)}); }
export async function changePassword(req,res,next) {
  try {
    const current=String(req.body?.currentPassword||""); const nextPassword=String(req.body?.newPassword||"");
    if(nextPassword.length<PASSWORD_MIN_LENGTH) return res.status(400).json({error:`New password must be at least ${PASSWORD_MIN_LENGTH} characters.`});
    const r=await pool.query("SELECT * FROM app_users WHERE id=$1",[req.user.id]);
    if(!r.rowCount || !verifyPassword(current,r.rows[0].password_salt,r.rows[0].password_hash)) return res.status(401).json({error:"Current password is incorrect."});
    const p=hashPassword(nextPassword);
    await pool.query("UPDATE app_users SET password_salt=$1,password_hash=$2,must_change_password=FALSE,updated_at=NOW() WHERE id=$3",[p.salt,p.hash,req.user.id]);
    res.json({success:true});
  } catch(e){next(e);}
}

export async function listUsers(req,res,next) {
  try { const r=await pool.query(`SELECT u.id,u.username,u.role,u.branch_id,u.till_id,u.status,u.must_change_password,u.last_login_at,b.name AS branch_name,t.name AS till_name FROM app_users u LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN tills t ON t.id=u.till_id ORDER BY u.username,u.id`); res.json(r.rows.map(publicUser)); } catch(e){next(e);}
}
export async function createUser(req,res,next) {
  try {
    const username=String(req.body?.username||"").trim().toLowerCase(); const role=String(req.body?.role||"").toUpperCase(); const branchId=req.body?.branchId?Number(req.body.branchId):null; const tillId=req.body?.tillId?Number(req.body.tillId):null; const password=String(req.body?.password||"");
    if(!/^[a-z0-9._-]{3,50}$/.test(username)) return res.status(400).json({error:"Username must be 3-50 characters and use letters, numbers, dot, underscore or hyphen."});
    if(!["MANAGER","SUPERVISOR","BRANCH_USER"].includes(role)) return res.status(400).json({error:"Invalid user role."});
    if(password.length<PASSWORD_MIN_LENGTH) return res.status(400).json({error:`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`});
    if(["BRANCH_USER","SUPERVISOR"].includes(role) && (!branchId || !Number.isInteger(branchId))) return res.status(400).json({error:"A Branch User or Supervisor must be assigned to a branch."});
    if(role==="BRANCH_USER" && (!tillId || !Number.isInteger(tillId))) return res.status(400).json({error:"A Branch User must be assigned to a Till."});
    if(role!=="BRANCH_USER" && tillId) return res.status(400).json({error:"Only Branch Users receive a Till assignment."});
    if(role==="MANAGER" && branchId) return res.status(400).json({error:"Manager accounts are company-wide and do not receive a branch assignment."});
    if(branchId) { const b=await pool.query("SELECT id FROM branches WHERE id=$1",[branchId]); if(!b.rowCount)return res.status(400).json({error:"Selected branch does not exist."}); }
    if(tillId) {
      const t=await pool.query("SELECT id,branch_id,status FROM tills WHERE id=$1",[tillId]);
      if(!t.rowCount)return res.status(400).json({error:"Selected Till does not exist."});
      if(t.rows[0].status!=="ACTIVE")return res.status(400).json({error:"Selected Till is not active."});
      if(Number(t.rows[0].branch_id)!==branchId)return res.status(400).json({error:"Selected Till does not belong to the selected branch."});
      const assigned=await pool.query("SELECT id FROM app_users WHERE till_id=$1 AND role='BRANCH_USER' AND status='ACTIVE'",[tillId]);
      if(assigned.rowCount)return res.status(409).json({error:"Selected Till is already assigned to an active Branch User."});
    }
    const exists=await pool.query("SELECT id FROM app_users WHERE LOWER(username)=LOWER($1)",[username]); if(exists.rowCount)return res.status(409).json({error:"Username already exists."});
    const p=hashPassword(password); const r=await pool.query(`INSERT INTO app_users(username,password_salt,password_hash,role,branch_id,till_id,must_change_password,status) VALUES($1,$2,$3,$4,$5,$6,TRUE,'ACTIVE') RETURNING id,username,role,branch_id,till_id,status,must_change_password`,[username,p.salt,p.hash,role,branchId,tillId]);
    res.status(201).json(publicUser(r.rows[0]));
  }catch(e){next(e);}
}

export async function resetBranchUserPassword(req,res,next) {
  try {
    const id = Number(req.params.id);
    const newPassword = String(req.body?.newPassword || "");
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid user." });
    if (newPassword.length < PASSWORD_MIN_LENGTH) return res.status(400).json({ error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` });

    const target = await pool.query(
      "SELECT id, username, role, status FROM app_users WHERE id=$1 LIMIT 1",
      [id]
    );
    if (!target.rowCount) return res.status(404).json({ error: "User not found." });
    if (!["BRANCH_USER","SUPERVISOR"].includes(target.rows[0].role)) return res.status(400).json({ error: "Only Branch User or Supervisor passwords can be reset here." });

    const p = hashPassword(newPassword);
    await pool.query(
      "UPDATE app_users SET password_salt=$1,password_hash=$2,must_change_password=TRUE,updated_at=NOW() WHERE id=$3",
      [p.salt, p.hash, id]
    );
    await pool.query("DELETE FROM auth_sessions WHERE user_id=$1", [id]);
    res.json({ success: true, username: target.rows[0].username });
  } catch (e) { next(e); }
}

export async function updateUser(req,res,next) {
  try {
    const id=Number(req.params.id); const role=String(req.body?.role||"").toUpperCase(); const branchId=req.body?.branchId?Number(req.body.branchId):null; const tillId=req.body?.tillId?Number(req.body.tillId):null; const status=String(req.body?.status||"").toUpperCase();
    if(!["MANAGER","SUPERVISOR","BRANCH_USER"].includes(role)||!["ACTIVE","INACTIVE"].includes(status))return res.status(400).json({error:"Invalid role or status."});
    if(["BRANCH_USER","SUPERVISOR"].includes(role)&&!branchId)return res.status(400).json({error:"A Branch User or Supervisor must have a branch."});
    if(role==="BRANCH_USER"&&!tillId)return res.status(400).json({error:"A Branch User must have a Till."});
    if(role!=="BRANCH_USER"&&tillId)return res.status(400).json({error:"Only Branch Users receive a Till assignment."});
    if(role==="MANAGER"&&branchId)return res.status(400).json({error:"Manager accounts are company-wide."});
    if(tillId){ const t=await pool.query("SELECT id,branch_id,status FROM tills WHERE id=$1",[tillId]); if(!t.rowCount)return res.status(400).json({error:"Selected Till does not exist."}); if(t.rows[0].status!=="ACTIVE")return res.status(400).json({error:"Selected Till is not active."}); if(Number(t.rows[0].branch_id)!==branchId)return res.status(400).json({error:"Selected Till does not belong to the selected branch."}); const assigned=await pool.query("SELECT id FROM app_users WHERE till_id=$1 AND role='BRANCH_USER' AND status='ACTIVE' AND id<>$2",[tillId,id]); if(assigned.rowCount)return res.status(409).json({error:"Selected Till is already assigned to another active Branch User."}); }
    const r=await pool.query(`UPDATE app_users SET role=$1,branch_id=$2,till_id=$3,status=$4,updated_at=NOW() WHERE id=$5 RETURNING id,username,role,branch_id,till_id,status,must_change_password`,[role,branchId,tillId,status,id]); if(!r.rowCount)return res.status(404).json({error:"User not found."}); res.json(publicUser(r.rows[0]));
  }catch(e){next(e);}
}

export { hashToken };

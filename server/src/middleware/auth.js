import crypto from "crypto";
import { pool } from "../config/database.js";

function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }

export async function requireAuth(req,res,next) {
  try {
    const header=String(req.headers.authorization||"");
    if(!header.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required."});
    const token=header.slice(7).trim();
    if(!token) return res.status(401).json({error:"Authentication required."});
    const r=await pool.query(`SELECT u.id,u.username,u.role,u.branch_id,u.till_id,u.status,u.must_change_password,b.name AS branch_name,t.name AS till_name
      FROM auth_sessions s JOIN app_users u ON u.id=s.user_id LEFT JOIN branches b ON b.id=u.branch_id LEFT JOIN tills t ON t.id=u.till_id
      WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.status='ACTIVE' LIMIT 1`,[hashToken(token)]);
    if(!r.rowCount) return res.status(401).json({error:"Your session has expired. Please log in again."});
    req.user={...r.rows[0],id:Number(r.rows[0].id),branch_id:r.rows[0].branch_id?Number(r.rows[0].branch_id):null, till_id:r.rows[0].till_id?Number(r.rows[0].till_id):null, till_name:r.rows[0].till_name||null};
    req.authToken=token;
    next();
  } catch(e){ next(e); }
}
export function requireManager(req,res,next){ if(req.user?.role!=="MANAGER") return res.status(403).json({error:"Manager access required."}); next(); }
export function requireBranchAccess(req,res,next){
  if(req.user?.role==="MANAGER") return next();
  const branchId = req.body?.branchId ?? req.query?.branchId ?? null;
  if(branchId && Number(branchId)!==Number(req.user.branch_id)) return res.status(403).json({error:"You can only access your assigned branch."});
  next();
}

export function requireSupervisorAccess(req,res,next){ if(["MANAGER","SUPERVISOR"].includes(req.user?.role)) return next(); return res.status(403).json({error:"Supervisor access required."}); }

export function requireAssignedTill(req,res,next){ if(req.user?.role!=="BRANCH_USER") return next(); if(!req.user.till_id) return res.status(403).json({error:"No Till is assigned to this Branch User. Please contact the Manager."}); const requested=Number(req.params.tillId||req.body?.tillId); if(requested && requested!==Number(req.user.till_id)) return res.status(403).json({error:"You can only access your assigned Till."}); req.params.tillId=String(req.user.till_id); if(req.body) req.body.tillId=Number(req.user.till_id); next(); }

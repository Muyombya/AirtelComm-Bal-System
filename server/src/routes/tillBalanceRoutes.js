import { Router } from "express";
import { requireBranchAccess, requireAssignedTill } from "../middleware/auth.js";
import { pool } from "../config/database.js";

async function tillBranch(req,res,next){ if(req.user.role==="MANAGER") return next(); const tillId=Number(req.params.tillId||req.body?.tillId); const r=await pool.query("SELECT branch_id FROM tills WHERE id=$1",[tillId]); if(!r.rowCount)return res.status(404).json({error:"Till not found."}); if(Number(r.rows[0].branch_id)!==Number(req.user.branch_id))return res.status(403).json({error:"You can only access Tills in your assigned branch."}); next(); }
import {
  getTillBalancingContext,
  createTillBalance,
  listTillBalances,
  getTillBalanceDetails,
} from "../controllers/tillBalanceController.js";

const router = Router();

router.get("/tills/:tillId/balancing-context", requireAssignedTill, tillBranch, getTillBalancingContext);
router.post("/till-balances", requireBranchAccess, requireAssignedTill, async (req,res,next)=>{ req.params.tillId=req.body?.tillId; return tillBranch(req,res,()=>createTillBalance(req,res,next)); });
router.get("/tills/:tillId/balances", requireAssignedTill, tillBranch, listTillBalances);
router.get("/till-balances/:balanceId", async (req,res,next)=>{ if(req.user.role==="MANAGER")return getTillBalanceDetails(req,res,next); const r=await pool.query("SELECT t.branch_id,t.id AS till_id FROM till_balances tb JOIN tills t ON t.id=tb.till_id WHERE tb.id=$1",[Number(req.params.balanceId)]); if(!r.rowCount)return res.status(404).json({error:"Balance not found."}); if(Number(r.rows[0].branch_id)!==Number(req.user.branch_id))return res.status(403).json({error:"You can only access balances in your assigned branch."}); if(req.user.role==="BRANCH_USER" && (!req.user.till_id || Number(r.rows[0].till_id)!==Number(req.user.till_id)))return res.status(403).json({error:"You can only access balances for your assigned Till."}); return getTillBalanceDetails(req,res,next); });

export default router;

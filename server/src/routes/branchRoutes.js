import { Router } from "express";
import { requireBranchAccess } from "../middleware/auth.js";
import { getBranches } from "../controllers/branchController.js";
import { pool } from "../config/database.js";

const router = Router();

router.get("/branches", requireBranchAccess, async (req, res, next) => {
  try {
    if (req.user.role === "MANAGER") return getBranches(req, res, next);
    const r = await pool.query(
      "SELECT id, name, contact, email, location, operating_capital, status FROM branches WHERE id=$1",
      [req.user.branch_id]
    );
    return res.json(r.rows);
  } catch (e) { next(e); }
});

export default router;

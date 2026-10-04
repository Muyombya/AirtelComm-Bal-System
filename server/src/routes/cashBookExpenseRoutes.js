import { Router } from "express";
import { requireBranchAccess, requireSupervisorAccess } from "../middleware/auth.js";
import { getExpenseCategories, getMonthlyExpenseReport, getExpenseLedger } from "../controllers/cashBookExpenseController.js";
import { emailMonthlyExpenseReport } from "../controllers/cashBookExpenseEmailController.js";

const router = Router();
router.get("/cash-book/expense-categories", requireSupervisorAccess, getExpenseCategories);
router.get("/cash-book/monthly-expenses", requireSupervisorAccess, requireBranchAccess, getMonthlyExpenseReport);
router.get("/cash-book/expense-ledger", requireSupervisorAccess, requireBranchAccess, getExpenseLedger);
router.post("/cash-book/monthly-expenses/email", requireSupervisorAccess, requireBranchAccess, emailMonthlyExpenseReport);
export default router;

import { Router } from "express";
import { requireBranchAccess, requireSupervisorAccess } from "../middleware/auth.js";
import { getCashBook,setCashBookOpeningBalance,createCashBookEntry,getCashBookHistory } from "../controllers/cashBookController.js";
const router=Router();
router.get("/cash-book",requireSupervisorAccess,requireBranchAccess,getCashBook);
router.put("/cash-book/opening-balance",requireSupervisorAccess,requireBranchAccess,setCashBookOpeningBalance);
router.post("/cash-book/entries",requireSupervisorAccess,requireBranchAccess,createCashBookEntry);
router.get("/cash-book/history",requireSupervisorAccess,requireBranchAccess,getCashBookHistory);
export default router;

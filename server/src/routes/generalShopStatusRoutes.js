import { Router } from "express";
import { requireBranchAccess, requireSupervisorAccess } from "../middleware/auth.js";
import { getGeneralShopStatus, saveGeneralShopStatus, recordShortagePayment } from "../controllers/generalShopStatusController.js";
const router=Router();
router.get("/general-shop-status",requireSupervisorAccess,requireBranchAccess,getGeneralShopStatus);
router.put("/general-shop-status",requireSupervisorAccess,requireBranchAccess,saveGeneralShopStatus);
router.post("/branch-shortages/payments",requireSupervisorAccess,requireBranchAccess,recordShortagePayment);
export default router;

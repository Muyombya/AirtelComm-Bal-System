import { Router } from "express";
import { requireManager } from "../middleware/auth.js";
import {
  createBranch, updateBranch, listMasterTills, createTill, updateTill,
  listEmployees, createEmployee, updateEmployee,
  listProviders, createProvider, updateProvider,
  getTillAssignment, setTillAssignment
} from "../controllers/masterDataController.js";

const router = Router();

function requireTillListAccess(req, res, next) {
  if (req.user?.role === "MANAGER") return next();
  if (req.user?.role === "SUPERVISOR") {
    if (!req.user.branch_id) return res.status(403).json({ error: "Supervisor is not assigned to a branch." });
    req.query.branchId = String(req.user.branch_id);
    return next();
  }
  return res.status(403).json({ error: "Supervisor access required." });
}

router.get("/master/tills", requireTillListAccess, listMasterTills);

router.use(requireManager);
router.post("/branches", createBranch);
router.put("/branches/:id", updateBranch);
router.post("/master/tills", createTill);
router.put("/master/tills/:id", updateTill);
router.get("/master/employees", listEmployees);
router.post("/master/employees", createEmployee);
router.put("/master/employees/:id", updateEmployee);
router.get("/master/service-providers", listProviders);
router.post("/master/service-providers", createProvider);
router.put("/master/service-providers/:id", updateProvider);
router.get("/master/tills/:tillId/assignment", getTillAssignment);
router.put("/master/tills/:tillId/assignment", setTillAssignment);
export default router;

import { Router } from "express";
import {
  listTerminals,
  createTerminal,
  updateTerminal,
  transferTerminal,
  removeTerminalFromBranch,
  listTerminalBranchHistory,
  listTillTerminals,
  assignTerminalToTill,
  unassignTerminalFromTill,
  reorderTillTerminals,
} from "../controllers/terminalController.js";

const router = Router();

router.get("/terminals", listTerminals);
router.post("/terminals", createTerminal);
router.put("/terminals/:id", updateTerminal);
router.put("/terminals/:id/branch", transferTerminal);
router.delete("/terminals/:id/branch", removeTerminalFromBranch);
router.get("/terminals/:id/branch-history", listTerminalBranchHistory);

router.get("/tills/:tillId/terminals", listTillTerminals);
router.post("/tills/:tillId/terminals", assignTerminalToTill);
router.delete("/tills/:tillId/terminals/:terminalId", unassignTerminalFromTill);
router.put("/tills/:tillId/terminals/order", reorderTillTerminals);

export default router;

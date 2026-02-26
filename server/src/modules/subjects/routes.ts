import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  bulkDeleteSubjects,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.delete("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteSubjects));
router.get("/", asyncHandler(listSubjects));
router.post("/", requireRole("Admin"), asyncHandler(createSubject));
router.put("/:id", requireRole("Admin"), asyncHandler(updateSubject));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteSubject));

export default router;

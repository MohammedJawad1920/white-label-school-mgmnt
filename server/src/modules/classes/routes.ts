import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  bulkDeleteClasses,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.delete("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteClasses));
router.get("/", asyncHandler(listClasses));
router.post("/", requireRole("Admin"), asyncHandler(createClass));
router.put("/:id", requireRole("Admin"), asyncHandler(updateClass));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteClass));

export default router;

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  bulkDeleteBatches,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.post("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteBatches));
router.get("/", asyncHandler(listBatches));
router.post("/", requireRole("Admin"), asyncHandler(createBatch));
router.put("/:id", requireRole("Admin"), asyncHandler(updateBatch));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteBatch));

export default router;

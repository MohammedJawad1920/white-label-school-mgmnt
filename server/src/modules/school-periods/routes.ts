import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("timetable"));

// Both Teacher and Admin can view periods (needed for timetable display)
router.get("/", asyncHandler(listPeriods));

// Only Admin can mutate periods
router.post("/", requireRole("Admin"), asyncHandler(createPeriod));
router.put("/:id", requireRole("Admin"), asyncHandler(updatePeriod));
router.delete("/:id", requireRole("Admin"), asyncHandler(deletePeriod));

export default router;

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import { getTimetable, createTimeslot, endTimeslot } from "./controller";

const router = Router();

// tenantContext first → featureGuard reads req.tenantId
router.use(tenantContextMiddleware);
router.use(featureGuard("timetable"));

// Both Teacher and Admin can view timetable
router.get("/", asyncHandler(getTimetable));
// Only Admin creates/ends slots
router.post("/", requireRole("Admin"), asyncHandler(createTimeslot));
router.put("/:id/end", requireRole("Admin"), asyncHandler(endTimeslot));

export default router;

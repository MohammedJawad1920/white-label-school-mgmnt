import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createEvent,
  listEvents,
  updateEvent,
  deleteEvent,
} from "./controller";

const router = Router({ mergeParams: true });

router.use(tenantContextMiddleware);

// POST /api/events  — Admin only
router.post("/", requireRole("Admin"), asyncHandler(createEvent));

// GET /api/events  — Admin, Teacher, Student
router.get(
  "/",
  requireRole("Admin", "Teacher", "Student"),
  asyncHandler(listEvents),
);

// PUT /api/events/:eventId  — Admin only
router.put("/:eventId", requireRole("Admin"), asyncHandler(updateEvent));

// DELETE /api/events/:eventId  — Admin only
router.delete("/:eventId", requireRole("Admin"), asyncHandler(deleteEvent));

export default router;

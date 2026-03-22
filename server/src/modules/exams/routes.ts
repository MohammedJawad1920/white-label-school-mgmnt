/**
 * Exams Routes — v5.0
 *
 * Mounted at /api/v1/exams
 * All routes require tenant context (JWT validated, tenantId + userId available).
 *
 * Also exports externalResultsRouter — mounted at /api/v1/external-results
 */

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
  publishExam,
  unpublishExam,
  addExamSubject,
  updateExamSubject,
  removeExamSubject,
  getMarks,
  enterMarks,
  getResults,
  getStudentResult,
  createExternalResult,
  listExternalResults,
  deleteExternalResult,
} from "./controller";

// ── Main exams router ────────────────────────────────────────────────────────
const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("exams"));

// CRUD
router.post("/", requireRole("Admin"), asyncHandler(createExam));
router.get("/", requireRole("Admin", "Teacher"), asyncHandler(listExams));
router.get(
  "/:id",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(getExam),
);
router.put("/:id", requireRole("Admin"), asyncHandler(updateExam));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteExam));

// Publish / unpublish
router.put("/:id/publish", requireRole("Admin"), asyncHandler(publishExam));
router.put("/:id/unpublish", requireRole("Admin"), asyncHandler(unpublishExam));

// Exam subjects
router.post(
  "/:id/subjects",
  requireRole("Admin"),
  asyncHandler(addExamSubject),
);
router.put(
  "/:id/subjects/:subjectId",
  requireRole("Admin"),
  asyncHandler(updateExamSubject),
);
router.delete(
  "/:id/subjects/:subjectId",
  requireRole("Admin"),
  asyncHandler(removeExamSubject),
);

// Marks entry / retrieval
router.get(
  "/:id/subjects/:subjectId/marks",
  requireRole("Admin", "Teacher"),
  asyncHandler(getMarks),
);
router.put(
  "/:id/subjects/:subjectId/marks",
  requireRole("Admin", "Teacher"),
  asyncHandler(enterMarks),
);

// Results
router.get(
  "/:id/results",
  requireRole("Admin", "Teacher"),
  asyncHandler(getResults),
);
router.get(
  "/:id/results/:studentId",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(getStudentResult),
);

export default router;

// ── External results router ───────────────────────────────────────────────────
// Mounted at /api/v1/external-results
export const externalResultsRouter = Router();
externalResultsRouter.use(tenantContextMiddleware);
externalResultsRouter.use(featureGuard("exams"));

externalResultsRouter.post(
  "/",
  requireRole("Admin"),
  asyncHandler(createExternalResult),
);
externalResultsRouter.get(
  "/",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(listExternalResults),
);
externalResultsRouter.delete(
  "/:id",
  requireRole("Admin"),
  asyncHandler(deleteExternalResult),
);

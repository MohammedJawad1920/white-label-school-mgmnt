import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
  linkStudentAccount,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

// NOTE: /bulk MUST precede /:id to avoid route shadowing
router.delete("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteStudents));
router.get("/", asyncHandler(listStudents));
router.get("/:id", asyncHandler(getStudent)); // CR-15: Admin + Teacher(scoped) + Student(own)
router.post("/", requireRole("Admin"), asyncHandler(createStudent));
// v3.4 CR-08: link-account must precede /:id  (DEPRECATED v3.5 — backend retained only)
router.put(
  "/:studentId/link-account",
  requireRole("Admin"),
  asyncHandler(linkStudentAccount),
);
// v3.5 CR-13: update student (must come AFTER /:studentId/link-account)
router.put("/:id", requireRole("Admin"), asyncHandler(updateStudent));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteStudent));

export default router;

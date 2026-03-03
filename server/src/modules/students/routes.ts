import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listStudents,
  createStudent,
  deleteStudent,
  bulkDeleteStudents,
  linkStudentAccount,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

// NOTE: /bulk MUST precede /:id to avoid route shadowing
router.delete("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteStudents));
router.get("/", asyncHandler(listStudents));
router.post("/", requireRole("Admin"), asyncHandler(createStudent));
// v3.4 CR-08: link-account must precede /:id
router.put(
  "/:studentId/link-account",
  requireRole("Admin"),
  asyncHandler(linkStudentAccount),
);
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteStudent));

export default router;

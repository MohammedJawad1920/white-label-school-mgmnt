import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listStudents,
  createStudent,
  deleteStudent,
  bulkDeleteStudents,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

// NOTE: No PUT /:id — there is no PUT /students/:id in the OpenAPI contract
router.delete("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteStudents));
router.get("/", asyncHandler(listStudents));
router.post("/", requireRole("Admin"), asyncHandler(createStudent));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteStudent));

export default router;

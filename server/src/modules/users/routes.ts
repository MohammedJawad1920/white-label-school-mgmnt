/**
 * IMPORTANT: /bulk MUST be declared BEFORE /:id
 * WHY: Express matches top-to-bottom. If /:id came first, DELETE /users/bulk
 * would capture "bulk" as the id param and call deleteUser — wrong handler.
 */
import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  listUsers,
  getUser,
  createUser,
  updateUserRoles,
  deleteUser,
  bulkDeleteUsers,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.post("/bulk", requireRole("Admin"), asyncHandler(bulkDeleteUsers));
router.get("/", asyncHandler(listUsers));
router.get("/:id", requireRole("Admin"), asyncHandler(getUser));
router.post("/", requireRole("Admin"), asyncHandler(createUser));
router.put("/:id/roles", requireRole("Admin"), asyncHandler(updateUserRoles));
router.delete("/:id", requireRole("Admin"), asyncHandler(deleteUser));

export default router;

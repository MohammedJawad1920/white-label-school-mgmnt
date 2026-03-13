import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import { getGradeConfig } from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

// GET /settings/grade-config — Admin only (used by report card generation)
router.get("/grade-config", requireRole("Admin"), asyncHandler(getGradeConfig));

export default router;

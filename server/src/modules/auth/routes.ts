import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { asyncHandler } from "../../utils/asyncHandler";
import { tenantLogin, tenantLogout, switchRole } from "./controller";

const router = Router();

router.post("/login", asyncHandler(tenantLogin)); // public — no middleware
router.post("/logout", tenantContextMiddleware, asyncHandler(tenantLogout));
router.post("/switch-role", tenantContextMiddleware, asyncHandler(switchRole));

export default router;

/**
 * Fees Routes — v5.0
 *
 * Mounted at /api/v1/fees
 * All routes require tenant context (JWT validated, tenantId + userId available).
 */

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createCharge,
  bulkCharge,
  listCharges,
  deleteCharge,
  recordPayment,
  feeSummary,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

// Fee charges
router.post("/charges", requireRole("Admin"), asyncHandler(createCharge));
router.post("/charges/bulk", requireRole("Admin"), asyncHandler(bulkCharge));
router.get(
  "/charges",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(listCharges),
);
router.delete("/charges/:id", requireRole("Admin"), asyncHandler(deleteCharge));

// Payments
router.post(
  "/charges/:id/payments",
  requireRole("Admin"),
  asyncHandler(recordPayment),
);

// Summary
router.get(
  "/summary",
  requireRole("Admin", "Teacher"),
  asyncHandler(feeSummary),
);

export default router;

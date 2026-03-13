import { Router } from "express";
import multer from "multer";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import { getProfile, updateProfile, uploadProfileFile } from "./controller";

const router = Router();

// Store upload in memory (buffer) — forwarded directly to R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB guard at transport layer
});

router.use(tenantContextMiddleware);

// GET /school-profile — all tenant roles
router.get(
  "/",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(getProfile),
);

// PUT /school-profile — Admin only
router.put("/", requireRole("Admin"), asyncHandler(updateProfile));

// POST /school-profile/upload — Admin only, multipart/form-data
router.post(
  "/upload",
  requireRole("Admin"),
  upload.single("file"),
  asyncHandler(uploadProfileFile),
);

export default router;

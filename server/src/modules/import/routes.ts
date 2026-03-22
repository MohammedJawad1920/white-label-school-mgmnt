import { Router } from "express";
import multer from "multer";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("import"));

// /template/:entity must come before /:jobId
router.get(
  "/template/:entity",
  requireRole("Admin"),
  asyncHandler(controller.downloadTemplate),
);
router.get(
  "/history",
  requireRole("Admin"),
  asyncHandler(controller.importHistory),
);
router.post(
  "/preview",
  requireRole("Admin"),
  upload.single("file"),
  asyncHandler(controller.previewImport),
);
router.post(
  "/:jobId/confirm",
  requireRole("Admin"),
  asyncHandler(controller.confirmImport),
);
router.delete(
  "/:jobId",
  requireRole("Admin"),
  asyncHandler(controller.cancelImport),
);

export default router;

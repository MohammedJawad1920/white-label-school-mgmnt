import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createSession,
  listSessions,
  getCurrentSession,
  activateSession,
  closeSession,
  copyTimetable,
  transitionPreview,
  transitionCommit,
  rollbackPromotion,
} from "./controller";

const router = Router();

// All routes require tenant context
router.use(tenantContextMiddleware);

// GET /academic-sessions/current  — all roles (Admin, Teacher, Student, Guardian)
router.get("/current", asyncHandler(getCurrentSession));

// GET /academic-sessions — Admin only
router.get("/", requireRole("Admin"), asyncHandler(listSessions));

// POST /academic-sessions — Admin only
router.post("/", requireRole("Admin"), asyncHandler(createSession));

// PUT /academic-sessions/:id/activate — Admin only
router.put(
  "/:id/activate",
  requireRole("Admin"),
  asyncHandler(activateSession),
);

// PUT /academic-sessions/:id/close — Admin only
router.put("/:id/close", requireRole("Admin"), asyncHandler(closeSession));

// POST /academic-sessions/:id/copy-timetable — Admin only
router.post(
  "/:id/copy-timetable",
  requireRole("Admin"),
  asyncHandler(copyTimetable),
);

// POST /academic-sessions/:id/transition/preview — Admin only
router.post(
  "/:id/transition/preview",
  requireRole("Admin"),
  asyncHandler(transitionPreview),
);

// POST /academic-sessions/:id/transition/commit — Admin only
router.post(
  "/:id/transition/commit",
  requireRole("Admin"),
  asyncHandler(transitionCommit),
);

export default router;

// ─── Separate router for /promotions/:id/rollback ───────────────────────────
export const promotionsRouter = Router();
promotionsRouter.use(tenantContextMiddleware);
promotionsRouter.post(
  "/:id/rollback",
  requireRole("Admin"),
  asyncHandler(rollbackPromotion),
);

const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const { requireFeature } = require("../middleware/featureGuard");
const {
  createTimeSlot,
  endTimeSlot,
  getTimetable,
} = require("../controllers/timetableController");

const router = express.Router();

// CRITICAL: Order matters with router.use()!
// These apply to ALL routes defined below
router.use(tenantContextMiddleware); // FIRST: Set req.context
router.use(requireFeature("timetable")); // SECOND: Check feature (uses req.context)

// Now all routes have both middleware in correct order
router.get("/", getTimetable);
router.post("/", createTimeSlot);
router.put("/:timeSlotId/end", endTimeSlot);

module.exports = router;

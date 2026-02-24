// FILE: server/routes/timetableRoutes.js
// CHANGE: Add feature guard to check if timetable module is enabled

const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const { requireFeature } = require("../middleware/featureGuard"); // ADD THIS LINE
const {
  createTimeSlot,
  endTimeSlot,
  getTimetable,
} = require("../controllers/timetableController");

const router = express.Router();

// CRITICAL: Check if timetable feature is enabled
router.use(requireFeature("timetable")); // ADD THIS LINE

// GET /api/timetable
router.get("/", tenantContextMiddleware, getTimetable);

// POST /api/timetable (FIXED: removed /create)
router.post("/", tenantContextMiddleware, createTimeSlot);

// PUT /api/timetable/:timeSlotId/end
router.put("/:timeSlotId/end", tenantContextMiddleware, endTimeSlot);

module.exports = router;

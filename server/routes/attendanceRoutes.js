// FILE: server/routes/attendanceRoutes.js
// CHANGE: Add feature guard to check if attendance module is enabled

const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const { requireFeature } = require("../middleware/featureGuard"); // ADD THIS LINE
const {
  recordClassAttendance,
  getAttendanceSummary,
} = require("../controllers/attendanceController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// CRITICAL: Check if attendance feature is enabled
router.use(requireFeature("attendance")); // ADD THIS LINE

// POST /api/attendance/record-class
router.post("/record-class", recordClassAttendance);

// GET /api/attendance/summary
router.get("/summary", getAttendanceSummary);

module.exports = router;

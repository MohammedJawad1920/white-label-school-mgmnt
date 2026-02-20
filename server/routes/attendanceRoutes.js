const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  recordClassAttendance,
  getAttendanceSummary,
} = require("../controllers/attendanceController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// POST /api/attendance/record-class
router.post("/record-class", recordClassAttendance);

// GET /api/attendance/summary
router.get("/summary", getAttendanceSummary);

module.exports = router;

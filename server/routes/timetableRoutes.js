const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  createTimeSlot,
  endTimeSlot,
  getTimetable,
} = require("../controllers/timetableController");

const router = express.Router();

// GET /api/timetable
router.get("/", tenantContextMiddleware, getTimetable);

// POST /api/timetable (FIXED: removed /create)
router.post("/", tenantContextMiddleware, createTimeSlot);

// PUT /api/timetable/:timeSlotId/end
router.put("/:timeSlotId/end", tenantContextMiddleware, endTimeSlot);

module.exports = router;

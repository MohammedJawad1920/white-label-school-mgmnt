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

// POST /api/timetable/create
router.post("/create", tenantContextMiddleware, createTimeSlot);

// PUT /api/timetable/:timeSlotId/end
router.put("/:timeSlotId/end", tenantContextMiddleware, endTimeSlot);

module.exports = router;

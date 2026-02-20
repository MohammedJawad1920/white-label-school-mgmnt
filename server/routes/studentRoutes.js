const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/studentController");
const { getStudentAttendance } = require("../controllers/attendanceController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// GET /api/students
router.get("/", getStudents);

// POST /api/students
router.post("/", createStudent);

// GET /api/students/:studentId/attendance
router.get("/:studentId/attendance", getStudentAttendance);

// PUT /api/students/:id
router.put("/:id", updateStudent);

// DELETE /api/students/:id
router.delete("/:id", deleteStudent);

module.exports = router;

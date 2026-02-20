const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const timetableRoutes = require("./routes/timetableRoutes");
const batchRoutes = require("./routes/batchRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const classRoutes = require("./routes/classRoutes");
const userRoutes = require("./routes/userRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found",
      details: {},
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      details: {},
      timestamp: new Date().toISOString(),
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log("\n📚 Available endpoints:");
  console.log("   POST   /api/auth/login");
  console.log("   POST   /api/auth/logout");
  console.log("   GET    /api/batches");
  console.log("   POST   /api/batches");
  console.log("   PUT    /api/batches/:id");
  console.log("   DELETE /api/batches/:id");
  console.log("   GET    /api/subjects");
  console.log("   POST   /api/subjects");
  console.log("   PUT    /api/subjects/:id");
  console.log("   DELETE /api/subjects/:id");
  console.log("   GET    /api/classes");
  console.log("   POST   /api/classes");
  console.log("   PUT    /api/classes/:id");
  console.log("   DELETE /api/classes/:id");
  console.log("   GET    /api/users");
  console.log("   POST   /api/users");
  console.log("   PUT    /api/users/:id");
  console.log("   DELETE /api/users/:id");
  console.log("   GET    /api/timetable");
  console.log("   POST   /api/timetable");
  console.log("   PUT    /api/timetable/:timeSlotId/end");
  console.log("   GET    /api/students");
  console.log("   POST   /api/students");
  console.log("   GET    /api/students/:studentId/attendance");
  console.log("   PUT    /api/students/:id");
  console.log("   DELETE /api/students/:id");
  console.log("   POST   /api/attendance/record-class");
  console.log("   GET    /api/attendance/summary");
});

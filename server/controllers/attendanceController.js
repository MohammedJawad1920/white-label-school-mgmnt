const { nanoid } = require("nanoid");
const db = require("../config/database");

// POST /api/attendance/record-class
async function recordClassAttendance(req, res) {
  try {
    const { tenantId, roles, userId } = req.context;
    const { timeSlotId, date, defaultStatus, exceptions = [] } = req.body;

    // Validation
    if (!timeSlotId || !date || !defaultStatus) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "timeSlotId, date, and defaultStatus are required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate status enum
    const validStatuses = ["Present", "Absent", "Late"];
    if (!validStatuses.includes(defaultStatus)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid defaultStatus",
          details: { validStatuses },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate date is not in future
    const today = new Date().toISOString().split("T")[0];
    if (date > today) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Date cannot be in the future",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get timeslot (filter deleted)
    const timeslotQuery = await db.query(
      `SELECT ts.id, ts.class_id, ts.teacher_id, c.name as class_name, s.name as subject_name, ts.period_number
       FROM time_slots ts
       JOIN classes c ON ts.class_id = c.id
       JOIN subjects s ON ts.subject_id = s.id
       WHERE ts.id = $1 AND ts.tenant_id = $2 AND ts.deleted_at IS NULL`,
      [timeSlotId, tenantId],
    );

    if (timeslotQuery.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "TimeSlot does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const timeSlot = timeslotQuery.rows[0];

    // Authorization: Teacher must be assigned to this timeslot, or Admin
    if (!roles.includes("Admin")) {
      if (timeSlot.teacher_id !== userId) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You are not assigned to this class period",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Check for duplicate attendance record
    const duplicateCheck = await db.query(
      "SELECT COUNT(*) as count FROM attendance_records WHERE timeslot_id = $1 AND date = $2 AND tenant_id = $3",
      [timeSlotId, date, tenantId],
    );

    if (parseInt(duplicateCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Attendance already recorded for this date/timeSlot",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Get students in class (filter deleted)
    const studentsQuery = await db.query(
      "SELECT id FROM students WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY name",
      [timeSlot.class_id, tenantId],
    );

    if (studentsQuery.rows.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "No students in this class",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const students = studentsQuery.rows;

    // Create exception map for fast lookup
    const exceptionMap = {};
    exceptions.forEach((exc) => {
      if (!validStatuses.includes(exc.status)) {
        throw new Error(`Invalid exception status: ${exc.status}`);
      }
      exceptionMap[exc.studentId] = exc.status;
    });

    // Record attendance for each student
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    for (const student of students) {
      const status = exceptionMap[student.id] || defaultStatus;
      const recordId = nanoid(10);

      await db.query(
        `INSERT INTO attendance_records (id, tenant_id, student_id, timeslot_id, date, status, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [recordId, tenantId, student.id, timeSlotId, date, status, userId],
      );

      if (status === "Present") presentCount++;
      else if (status === "Absent") absentCount++;
      else if (status === "Late") lateCount++;
    }

    return res.status(201).json({
      recorded: students.length,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      date,
      timeSlot: {
        id: timeSlot.id,
        className: timeSlot.class_name,
        subjectName: timeSlot.subject_name,
        periodNumber: timeSlot.period_number,
      },
    });
  } catch (error) {
    console.error("Record class attendance error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while recording attendance",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

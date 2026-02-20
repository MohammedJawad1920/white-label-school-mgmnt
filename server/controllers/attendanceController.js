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

// GET /api/students/:studentId/attendance
async function getStudentAttendance(req, res) {
  try {
    const { tenantId, roles, userId } = req.context;
    const { studentId } = req.params;
    const { from, to, limit = 50, offset = 0 } = req.query;

    // Validate pagination
    const limitInt = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const offsetInt = Math.max(parseInt(offset) || 0, 0);

    // Get student
    const studentQuery = await db.query(
      `SELECT s.id, s.name, s.class_id, c.name as class_name
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,
      [studentId, tenantId],
    );

    if (studentQuery.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Student does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const student = studentQuery.rows[0];

    // Authorization: Teacher can only see students in their assigned classes
    if (!roles.includes("Admin")) {
      const teacherClassCheck = await db.query(
        `SELECT COUNT(*) as count FROM time_slots 
         WHERE teacher_id = $1 AND class_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [userId, student.class_id, tenantId],
      );

      if (parseInt(teacherClassCheck.rows[0].count) === 0) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You cannot access students outside your classes",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Build attendance query
    let attendanceQuery = `
      SELECT 
        ar.id,
        ar.date,
        ar.status,
        ar.recorded_at,
        ts.id as timeslot_id,
        s.name as subject_name,
        ts.period_number,
        ts.day_of_week,
        u.name as recorded_by_name
      FROM attendance_records ar
      JOIN time_slots ts ON ar.timeslot_id = ts.id
      JOIN subjects s ON ts.subject_id = s.id
      JOIN users u ON ar.recorded_by = u.id
      WHERE ar.student_id = $1 AND ar.tenant_id = $2
    `;
    const params = [studentId, tenantId];
    let paramCount = 2;

    if (from) {
      paramCount++;
      attendanceQuery += ` AND ar.date >= $${paramCount}`;
      params.push(from);
    }

    if (to) {
      paramCount++;
      attendanceQuery += ` AND ar.date <= $${paramCount}`;
      params.push(to);
    }

    // Get total count
    const countQuery = attendanceQuery.replace(
      /SELECT.*FROM/s,
      "SELECT COUNT(*) as total FROM",
    );
    const countResult = await db.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].total);

    // Add ordering and pagination
    attendanceQuery += ` ORDER BY ar.date DESC, ts.period_number ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limitInt, offsetInt);

    const attendanceResult = await db.query(attendanceQuery, params);

    // Calculate summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late
      FROM attendance_records
      WHERE student_id = $1 AND tenant_id = $2
    `;
    const summaryParams = [studentId, tenantId];
    let summaryParamCount = 2;

    if (from) {
      summaryParamCount++;
      summaryQuery += ` AND date >= $${summaryParamCount}`;
      summaryParams.push(from);
    }

    if (to) {
      summaryParamCount++;
      summaryQuery += ` AND date <= $${summaryParamCount}`;
      summaryParams.push(to);
    }

    const summaryResult = await db.query(summaryQuery, summaryParams);
    const summary = summaryResult.rows[0];

    const presentCount = parseInt(summary.present) || 0;
    const absentCount = parseInt(summary.absent) || 0;
    const lateCount = parseInt(summary.late) || 0;
    const totalCount = presentCount + absentCount + lateCount;
    const attendanceRate =
      totalCount > 0
        ? parseFloat(
            (((presentCount + lateCount) / totalCount) * 100).toFixed(2),
          )
        : 0;

    return res.status(200).json({
      student: {
        id: student.id,
        name: student.name,
        classId: student.class_id,
        className: student.class_name,
      },
      records: attendanceResult.rows.map((r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        timeSlot: {
          id: r.timeslot_id,
          subjectName: r.subject_name,
          periodNumber: r.period_number,
          dayOfWeek: r.day_of_week,
        },
        recordedBy: r.recorded_by_name,
        recordedAt: r.recorded_at,
      })),
      summary: {
        totalRecords: totalCount,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        attendanceRate,
      },
      pagination: {
        limit: limitInt,
        offset: offsetInt,
        total: totalRecords,
      },
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching attendance",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// GET /api/attendance/summary
async function getAttendanceSummary(req, res) {
  try {
    const { tenantId, roles, userId } = req.context;
    const { classId, from, to } = req.query;

    // Validation
    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "from and to dates are required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If classId not provided and not Admin, return error
    if (!classId && !roles.includes("Admin")) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "classId is required for teachers",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Authorization: Teacher can only see their assigned classes
    if (classId && !roles.includes("Admin")) {
      const teacherClassCheck = await db.query(
        `SELECT COUNT(*) as count FROM time_slots 
         WHERE teacher_id = $1 AND class_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [userId, classId, tenantId],
      );

      if (parseInt(teacherClassCheck.rows[0].count) === 0) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You can only view summary for your assigned classes",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Get class info
    let classInfo = null;
    if (classId) {
      const classQuery = await db.query(
        "SELECT id, name FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [classId, tenantId],
      );

      if (classQuery.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Class does not exist",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }

      classInfo = classQuery.rows[0];

      // Get student count
      const studentCountQuery = await db.query(
        "SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [classId, tenantId],
      );
      classInfo.studentCount = parseInt(studentCountQuery.rows[0].count);
    }

    // Build summary query
    let summaryQuery = `
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      WHERE ar.tenant_id = $1 AND ar.date >= $2 AND ar.date <= $3
        AND s.deleted_at IS NULL
    `;
    const params = [tenantId, from, to];
    let paramCount = 3;

    if (classId) {
      paramCount++;
      summaryQuery += ` AND s.class_id = $${paramCount}`;
      params.push(classId);
    }

    const summaryResult = await db.query(summaryQuery, params);
    const summary = summaryResult.rows[0];

    const totalRecords = parseInt(summary.total_records) || 0;
    const presentCount = parseInt(summary.present) || 0;
    const absentCount = parseInt(summary.absent) || 0;
    const lateCount = parseInt(summary.late) || 0;
    const attendanceRate =
      totalRecords > 0
        ? parseFloat(
            (((presentCount + lateCount) / totalRecords) * 100).toFixed(2),
          )
        : 0;

    // Get by-student breakdown
    let byStudentQuery = `
      SELECT 
        s.id as student_id,
        s.name as student_name,
        SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late
      FROM students s
      LEFT JOIN attendance_records ar ON s.id = ar.student_id 
        AND ar.date >= $2 AND ar.date <= $3 AND ar.tenant_id = $1
      WHERE s.tenant_id = $1 AND s.deleted_at IS NULL
    `;

    if (classId) {
      byStudentQuery += ` AND s.class_id = $4`;
    }

    byStudentQuery += ` GROUP BY s.id, s.name ORDER BY s.name`;

    const byStudentResult = await db.query(byStudentQuery, params);

    const byStudent = byStudentResult.rows.map((row) => {
      const present = parseInt(row.present) || 0;
      const absent = parseInt(row.absent) || 0;
      const late = parseInt(row.late) || 0;
      const total = present + absent + late;
      const rate =
        total > 0
          ? parseFloat((((present + late) / total) * 100).toFixed(2))
          : 0;

      return {
        studentId: row.student_id,
        studentName: row.student_name,
        present,
        absent,
        late,
        attendanceRate: rate,
      };
    });

    // Calculate days in period
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    const response = {
      period: {
        from,
        to,
        days: daysDiff,
      },
      summary: {
        totalRecords,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        attendanceRate,
      },
      byStudent,
    };

    if (classInfo) {
      response.class = classInfo;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Get attendance summary error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching summary",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = {
  recordClassAttendance,
  getStudentAttendance,
  getAttendanceSummary,
};

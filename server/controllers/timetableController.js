const { nanoid } = require("nanoid");
const db = require("../config/database");

async function getTimetable(req, res) {
  try {
    const { tenantId } = req.context;
    const { date, dayOfWeek, teacherId, classId, status } = req.query;

    // Build WHERE conditions
    const conditions = ["ts.tenant_id = $1"];
    const params = [tenantId];
    let paramCount = 1;

    // Add date filter if provided
    if (date) {
      paramCount++;
      conditions.push(`ts.effective_from <= $${paramCount}`);
      params.push(date);

      paramCount++;
      conditions.push(
        `(ts.effective_to IS NULL OR ts.effective_to >= $${paramCount})`,
      );
      params.push(date);
    }

    if (dayOfWeek) {
      paramCount++;
      conditions.push(`ts.day_of_week = $${paramCount}`);
      params.push(dayOfWeek);
    }
    if (teacherId) {
      paramCount++;
      conditions.push(`ts.teacher_id = $${paramCount}`);
      params.push(teacherId);
    }
    if (classId) {
      paramCount++;
      conditions.push(`ts.class_id = $${paramCount}`);
      params.push(classId);
    }

    // Add status filter
    if (!status || status === "Active") {
      conditions.push("ts.effective_to IS NULL");
    }

    // Build query with JOINs
    const query = `
      SELECT 
        ts.id,
        ts.class_id,
        c.name AS class_name,
        ts.subject_id,
        s.name AS subject_name,
        ts.teacher_id,
        u.name AS teacher_name,
        ts.day_of_week,
        ts.period_number,
        ts.start_time,
        ts.end_time,
        ts.effective_from,
        ts.effective_to
      FROM time_slots ts
      JOIN classes c ON ts.class_id = c.id
      JOIN subjects s ON ts.subject_id = s.id
      JOIN users u ON ts.teacher_id = u.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ts.day_of_week, ts.period_number
    `;

    const result = await db.query(query, params);

    return res.status(200).json({
      timetable: result.rows,
    });
  } catch (error) {
    console.error("Get timetable error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching timetable",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

async function createTimeSlot(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const {
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      periodNumber,
      effectiveFrom,
      startTime,
      endTime,
    } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can create TimeSlots",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validation
    if (
      !classId ||
      !subjectId ||
      !teacherId ||
      !dayOfWeek ||
      !periodNumber ||
      !effectiveFrom
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields",
          details: {
            required: [
              "classId",
              "subjectId",
              "teacherId",
              "dayOfWeek",
              "periodNumber",
              "effectiveFrom",
            ],
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate dayOfWeek
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    if (!validDays.includes(dayOfWeek)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid dayOfWeek",
          details: { validDays },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate periodNumber
    if (periodNumber < 1 || periodNumber > 10) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "periodNumber must be between 1 and 10",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify class exists
    const doesClassExist = await db.query(
      `SELECT id FROM classes WHERE id = $1 AND tenant_id = $2`,
      [classId, tenantId],
    );

    if (doesClassExist.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class not found",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify subject exists
    const doesSubjectExist = await db.query(
      `SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2`,
      [subjectId, tenantId],
    );

    if (doesSubjectExist.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Subject not found",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify teacher exists and has Teacher role
    const doesTeacherExist = await db.query(
      `SELECT id, roles FROM users WHERE id = $1 AND tenant_id = $2`,
      [teacherId, tenantId],
    );

    if (doesTeacherExist.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Teacher not found",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const teacherRoles = doesTeacherExist.rows[0].roles;
    if (!teacherRoles.includes("Teacher")) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "User does not have Teacher role",
          details: { userId: teacherId, roles: teacherRoles },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check for duplicate active slot
    const existingSlot = await db.query(
      `SELECT id FROM time_slots 
      WHERE tenant_id = $1 
      AND class_id = $2 
      AND day_of_week = $3 
      AND period_number = $4 
      AND effective_to IS NULL`,
      [tenantId, classId, dayOfWeek, periodNumber],
    );

    if (existingSlot.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Active TimeSlot already exists for this class/day/period",
          details: {
            existingSlotId: existingSlot.rows[0].id,
            classId,
            dayOfWeek,
            periodNumber,
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Create new timeslot
    const id = nanoid(10);

    const newTimeSlot = await db.query(
      `INSERT INTO time_slots (id, tenant_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, effective_from, effective_to)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL) RETURNING *`,
      [
        id,
        tenantId,
        classId,
        subjectId,
        teacherId,
        dayOfWeek,
        periodNumber,
        startTime,
        endTime,
        effectiveFrom,
      ],
    );

    return res.status(201).json({
      timeSlot: newTimeSlot.rows[0],
    });
  } catch (error) {
    console.error("Create timeslot error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating timeslot",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

async function endTimeSlot(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { timeSlotId } = req.params;
    const { effectiveTo } = req.body;

    // Step 1: Authorization (v3: Admin only)
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can end TimeSlot assignments",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Step 2: Validate required field
    if (!effectiveTo) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "effectiveTo is required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Step 3: Check if timeslot exists
    const existingSlot = await db.query(
      "SELECT id, effective_to FROM time_slots WHERE id = $1 AND tenant_id = $2",
      [timeSlotId, tenantId],
    );

    if (existingSlot.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "TimeSlot does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Step 4: Check if already ended
    if (existingSlot.rows[0].effective_to !== null) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "TimeSlot is already ended",
          details: {
            effectiveTo: existingSlot.rows[0].effective_to,
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Step 5: Update effective_to
    const result = await db.query(
      "UPDATE time_slots SET effective_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [effectiveTo, timeSlotId],
    );

    return res.status(200).json({
      timeSlot: result.rows[0],
    });
  } catch (error) {
    console.error("End timeslot error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while ending timeslot",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = { getTimetable, createTimeSlot, endTimeSlot };

const { nanoid } = require("nanoid");
const db = require("../config/database");

async function getTimetable(req, res) {
  try {
    const { tenantId } = req.context;
    const { date, dayOfWeek, teacherId, classId, status } = req.query;

    // Build WHERE conditions
    const conditions = ["tenant_id = $1"];
    const params = [tenantId];
    let paramCount = 1;

    // Add date filter if provided
    if (date) {
      paramCount++;
      conditions.push(`effective_from <= $${paramCount}`);
      params.push(date);

      paramCount++;
      conditions.push(
        `(effective_to IS NULL OR effective_to >= $${paramCount})`,
      );
      params.push(date);
    }

    if (dayOfWeek) {
      paramCount++;
      conditions.push(`day_of_week = $${paramCount}`);
      params.push(dayOfWeek);
    }
    if (teacherId) {
      paramCount++;
      conditions.push(`teacher_id = $${paramCount}`);
      params.push(teacherId);
    }
    if (classId) {
      paramCount++;
      conditions.push(`class_id = $${paramCount}`);
      params.push(classId);
    }

    // Add status filter
    if (!status || status === "Active") {
      conditions.push("effective_to IS NULL");
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
      error: "INTERNAL_ERROR",
      message: "An error occurred while fetching timetable",
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

    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Only Admin can create Time Slots",
      });
    }

    if (
      !classId ||
      !subjectId ||
      !teacherId ||
      !dayOfWeek ||
      !periodNumber ||
      !effectiveFrom
    ) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Missing required fields",
      });
    }

    const doesClassExist = await db.query(
      `SELECT id FROM classes WHERE id = $1 AND tenant_id = $2`,
      [classId, tenantId],
    );

    if (doesClassExist.rows.length === 0) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Class not found",
      });
    }
    const doesSubjectExist = await db.query(
      `SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2`,
      [subjectId, tenantId],
    );

    if (doesSubjectExist.rows.length === 0) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Subject not found",
      });
    }
    const doesTeacherExist = await db.query(
      `SELECT id, roles FROM users WHERE id = $1 AND tenant_id = $2`,
      [teacherId, tenantId],
    );

    if (doesTeacherExist.rows.length === 0) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Teacher not found",
      });
    }

    const teacherRoles = doesTeacherExist.rows[0].roles;
    if (!teacherRoles.includes("Teacher")) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "User does not have Teacher role",
      });
    }

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
        error: "CONFLICT",
        message: "Active Time Slot already exists for this class/day/period",
      });
    }
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
      error: "INTERNAL_ERROR",
      message: "An error occurred while creating timeslot",
    });
  }
}

async function endTimeSlot(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { timeSlotId } = req.params;
    const { effectiveTo } = req.body;

    // Step 1: Authorization (Admin only)
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Only Admin can end TimeSlot assignments",
      });
    }

    // Step 2: Validate required field
    if (!effectiveTo) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "effectiveTo is required",
      });
    }

    // Step 3: Check if timeslot exists
    const existingSlot = await db.query(
      "SELECT id, effective_to FROM time_slots WHERE id = $1 AND tenant_id = $2",
      [timeSlotId, tenantId],
    );

    if (existingSlot.rows.length === 0) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "TimeSlot does not exist",
      });
    }

    // Step 4: Check if already ended
    if (existingSlot.rows[0].effective_to !== null) {
      return res.status(409).json({
        error: "CONFLICT",
        message: "TimeSlot is already ended",
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
      error: "INTERNAL_ERROR",
      message: "An error occurred while ending timeslot",
    });
  }
}

module.exports = { getTimetable, createTimeSlot, endTimeSlot };

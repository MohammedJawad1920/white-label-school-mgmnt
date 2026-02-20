const { nanoid } = require("nanoid");
const db = require("../config/database");

// GET /api/students

async function getStudents(req, res) {
  try {
    const { tenantId, roles, userId } = req.context;
    const { classId, batchId, search, limit = 50, offset = 0 } = req.query;

    // Validate pagination
    const limitInt = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const offsetInt = Math.max(parseInt(offset) || 0, 0);

    // Authorization: Teacher can only see students in their assigned classes
    let authorizedClassIds = [];
    if (!roles.includes("Admin")) {
      // Get classes this teacher is assigned to
      const teacherClasses = await db.query(
        `SELECT DISTINCT class_id FROM time_slots 
        WHERE teacher_id = $1 
        AND tenant_id = $2 
        AND deleted_at = NULL`,
        [userId, tenantId],
      );
      authorizedClassIds = teacherClasses.rows.map((r) => r.class_id);

      if (authorizedClassIds.length === 0) {
        return res.status(200).json({
          students: [],
          pagination: { limit: limitInt, offset: offsetInt, total: 0 },
        });
      }
    }

    // Filter out soft-deleted records (students, classes, batches)
    let query = `
    SELECT s.*, c.name as class_name, b.name as batch_name 
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN batches b ON s.batch_id = b.id
    WHERE s.tenant_id = $1
    AND s.deleted_at = NULL
    AND c.deleted_at = NULL
    AND b.deleted_at = NULL
    `;
    const params = [tenantId];
    let paramCount = 1;

    // Teacher authorization filter
    if (!roles.includes("Admin")) {
      paramCount++;
      query += ` AND s.class_id = ANY($${paramCount}::text[])`;
      params.push(authorizedClassIds);
    }

    // Filter by classId
    if (classId) {
      paramCount++;
      query += ` AND s.class_id = $${paramCount}`;
      params.push(classId);
    }

    // Filter by batchId
    if (batchId) {
      paramCount++;
      query += ` AND s.batch_id = $${paramCount}`;
      params.push(batchId);
    }

    // Search by name
    if (search) {
      paramCount++;
      query += ` AND s.name ILIKE $${paramCount}`;
      params.push(search);
    }

    // Get total count
    const countQuery = query.replace(
      `SELECT s.*, c.name as class_name, b.name as batch_name`,
      `SELECT COUNT(*) as total`,
    );
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` ORDER BY s.name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limitInt, offsetInt);

    const result = await db.query(query, params);

    return res.status(200).json({
      students: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        classId: row.class_id,
        className: row.class_name,
        batchId: row.batch_id,
        batchName: row.batch_name,
      })),
      pagination: {
        limit: limitInt,
        offset: offsetInt,
        total,
      },
    });
  } catch (error) {
    console.error("Get students error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching students",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// POST /api/students
async function createStudent(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { name, classId, batchId } = req.body;

    // Authorization: Only Admin
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can create students",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validation
    if (!name || !classId || !batchId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "name, classId, and batchId are required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify class exists and not deleted
    const classCheck = await db.query(
      "SELECT batch_id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [classId, tenantId],
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // CRITICAL: Validate student batch matches class batch
    const classBatchId = classCheck.rows[0].batch_id;
    if (classBatchId !== batchId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Student batch must match class batch (Class is in batch ${classBatchId}, you provided ${batchId})`,
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const id = nanoid(10);

    const result = await db.query(
      `INSERT INTO students (id, tenant_id, name, class_id, batch_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, tenantId, name, classId, batchId],
    );

    return res.status(201).json({
      student: result.rows[0],
    });
  } catch (error) {
    console.error("Create student error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating student",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// PUT /api/students/:id
async function updateStudent(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;
    const { name, classId, batchId } = req.body;

    // Authorization: Only Admin
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can update students",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if student exists and not deleted
    const existing = await db.query(
      "SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Student does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If classId or batchId changing, validate consistency
    if (classId && batchId) {
      const classCheck = await db.query(
        "SELECT batch_id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [classId, tenantId],
      );

      if (classCheck.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Class does not exist",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }

      const classBatchId = classCheck.rows[0].batch_id;
      if (classBatchId !== batchId) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Student batch must match class batch (Class is in batch ${classBatchId}, you provided ${batchId})`,
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [id, tenantId];
    let paramCount = 2;

    if (classId !== undefined) {
      paramCount++;
      updates.push(`class_id = $${paramCount}`);
      params.push(classId);
    }
    if (batchId !== undefined) {
      paramCount++;
      updates.push(`batch_id = $${paramCount}`);
      params.push(batchId);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "No fields to update",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    updates.push(`updated_at = NOW()`);

    const query = `UPDATE students SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`;

    const result = await db.query(query, params);

    return res.status(200).json({
      student: result.rows[0],
    });
  } catch (error) {
    console.error("Update student error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while updating student",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// DELETE /api/students/:id (v3.1: SOFT DELETE)
async function deleteStudent(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;

    // Authorization: Only Admin
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can delete students",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if student exists and not already deleted
    const existing = await db.query(
      "SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Student does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check for attendance record references (RESTRICT constraint)
    const attendanceCheck = await db.query(
      "SELECT COUNT(*) as count FROM attendance_records WHERE student_id = $1",
      [id],
    );

    if (parseInt(attendanceCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete student with existing attendance records",
          details: {
            attendanceCount: parseInt(attendanceCheck.rows[0].count),
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // SOFT DELETE - Update deleted_at instead of hard delete
    await db.query(
      "UPDATE students SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    return res.status(204).send();
  } catch (error) {
    console.error("Delete student error:", error);

    // Handle foreign key constraint violations
    if (error.code === "23503") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete student due to existing references",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while deleting student",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
};

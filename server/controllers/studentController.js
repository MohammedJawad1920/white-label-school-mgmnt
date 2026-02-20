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

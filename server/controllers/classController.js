const { nanoid } = require("nanoid");
const db = require("../config/database");

// GET /api/classes
async function getClasses(req, res) {
  try {
    const { tenantId } = req.context;
    const { batchId, search } = req.query;

    // v3.1: Filter out soft-deleted records (both classes and batches)
    let query = `
      SELECT c.*, b.name as batch_name 
      FROM classes c
      JOIN batches b ON c.batch_id = b.id
      WHERE c.tenant_id = $1 AND c.deleted_at IS NULL AND b.deleted_at IS NULL
    `;
    const params = [tenantId];
    let paramCount = 1;

    if (batchId) {
      paramCount++;
      query += ` AND c.batch_id = $${paramCount}`;
      params.push(batchId);
    }

    if (search) {
      paramCount++;
      query += ` AND c.name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY c.name ASC`;

    const result = await db.query(query, params);

    return res.status(200).json({
      classes: result.rows,
    });
  } catch (error) {
    console.error("Get classes error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching classes",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// POST /api/classes
async function createClass(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { name, batchId } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can create classes",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validation
    if (!name || !batchId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "name and batchId are required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Verify batch exists and not deleted
    const batchCheck = await db.query(
      "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [batchId, tenantId],
    );

    if (batchCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Batch does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const id = nanoid(10);

    const result = await db.query(
      `INSERT INTO classes (id, tenant_id, name, batch_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, tenantId, name, batchId],
    );

    return res.status(201).json({
      class: result.rows[0],
    });
  } catch (error) {
    console.error("Create class error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating class",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// PUT /api/classes/:id
async function updateClass(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;
    const { name, batchId } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can update classes",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Check if class exists and not deleted
    const existing = await db.query(
      "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If batchId is being changed, verify new batch exists and not deleted
    if (batchId) {
      const batchCheck = await db.query(
        "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [batchId, tenantId],
      );

      if (batchCheck.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Batch does not exist",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }

      // v3.1: Check if non-deleted students exist that would violate batch constraint
      const studentCheck = await db.query(
        "SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND batch_id != $2 AND deleted_at IS NULL",
        [id, batchId],
      );

      if (parseInt(studentCheck.rows[0].count) > 0) {
        return res.status(409).json({
          error: {
            code: "CONFLICT",
            message:
              "Cannot change batch - students exist with different batch",
            details: {
              conflictingStudents: parseInt(studentCheck.rows[0].count),
            },
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [id, tenantId];
    let paramCount = 2;

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
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

    const query = `UPDATE classes SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`;

    const result = await db.query(query, params);

    return res.status(200).json({
      class: result.rows[0],
    });
  } catch (error) {
    console.error("Update class error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while updating class",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// DELETE /api/classes/:id (v3.1: SOFT DELETE)
async function deleteClass(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can delete classes",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Check if class exists and not already deleted
    const existing = await db.query(
      "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Check for student references (only non-deleted)
    const studentCheck = await db.query(
      "SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND deleted_at IS NULL",
      [id],
    );

    if (parseInt(studentCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete class with existing students",
          details: {
            studentCount: parseInt(studentCheck.rows[0].count),
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: SOFT DELETE - Update deleted_at instead of hard delete
    await db.query(
      "UPDATE classes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    return res.status(204).send();
  } catch (error) {
    console.error("Delete class error:", error);

    // Handle foreign key constraint violations
    if (error.code === "23503") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete class due to existing references",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while deleting class",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
};

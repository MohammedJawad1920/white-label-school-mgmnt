const { nanoid } = require("nanoid");
const db = require("../config/database");

// GET /api/subjects
async function getSubjects(req, res) {
  try {
    const { tenantId } = req.context;
    const { search } = req.query;

    // v3.1: Filter out soft-deleted records
    let query = `SELECT * FROM subjects WHERE tenant_id = $1 AND deleted_at IS NULL`;
    const params = [tenantId];

    if (search) {
      query += ` AND (name ILIKE $2 OR code ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY name ASC`;

    const result = await db.query(query, params);

    return res.status(200).json({
      subjects: result.rows,
    });
  } catch (error) {
    console.error("Get subjects error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching subjects",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// POST /api/subjects
async function createSubject(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { name, code } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can create subjects",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validation
    if (!name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "name is required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const id = nanoid(10);

    const result = await db.query(
      `INSERT INTO subjects (id, tenant_id, name, code)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, tenantId, name, code || null],
    );

    return res.status(201).json({
      subject: result.rows[0],
    });
  } catch (error) {
    console.error("Create subject error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating subject",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// PUT /api/subjects/:id
async function updateSubject(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;
    const { name, code } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can update subjects",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Check if subject exists and not deleted
    const existing = await db.query(
      "SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Subject does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
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
    if (code !== undefined) {
      paramCount++;
      updates.push(`code = $${paramCount}`);
      params.push(code);
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

    const query = `UPDATE subjects SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *`;

    const result = await db.query(query, params);

    return res.status(200).json({
      subject: result.rows[0],
    });
  } catch (error) {
    console.error("Update subject error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while updating subject",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// DELETE /api/subjects/:id (v3.1: SOFT DELETE)
async function deleteSubject(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can delete subjects",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Check if subject exists and not already deleted
    const existing = await db.query(
      "SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Subject does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: Check for timeslot references (only non-deleted)
    const timeslotCheck = await db.query(
      "SELECT COUNT(*) as count FROM time_slots WHERE subject_id = $1 AND deleted_at IS NULL",
      [id],
    );

    if (parseInt(timeslotCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete subject with existing timeslot assignments",
          details: {
            timeslotCount: parseInt(timeslotCheck.rows[0].count),
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // v3.1: SOFT DELETE - Update deleted_at instead of hard delete
    await db.query(
      "UPDATE subjects SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    return res.status(204).send();
  } catch (error) {
    console.error("Delete subject error:", error);

    // Handle foreign key constraint violations
    if (error.code === "23503") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete subject due to existing references",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while deleting subject",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
};

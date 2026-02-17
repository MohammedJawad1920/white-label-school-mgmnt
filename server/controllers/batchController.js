const { nanoid } = require("nanoid");
const db = require("../config/database");

// GET /api/batches
async function getBatches(req, res) {
  try {
    const { tenantId } = req.context;
    const { status } = req.query;

    let query = `SELECT * FROM batches WHERE tenant_id = $1`;
    const params = [tenantId];

    if (status && status !== "All") {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY start_year DESC`;

    const result = await db.query(query, params);

    return res.status(200).json({
      batches: result.rows,
    });
  } catch (error) {
    console.error("Get batches error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching batches",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// POST /api/batches
async function createBatch(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { name, startYear, endYear, status } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can create batches",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validation
    if (!name || !startYear || !endYear) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "name, startYear, and endYear are required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    const id = nanoid(10);
    const batchStatus = status || "Active";

    const result = await db.query(
      `INSERT INTO batches (id, tenant_id, name, start_year, end_year, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, tenantId, name, startYear, endYear, batchStatus],
    );

    return res.status(201).json({
      batch: result.rows[0],
    });
  } catch (error) {
    console.error("Create batch error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating batch",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// PUT /api/batches/:id
async function updateBatch(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;
    const { name, startYear, endYear, status } = req.body;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can update batches",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if batch exists
    const existing = await db.query(
      "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Batch does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [id, tenantId];
    let paramCount = 2;

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }
    if (startYear !== undefined) {
      paramCount++;
      updates.push(`start_year = $${paramCount}`);
      params.push(startYear);
    }
    if (endYear !== undefined) {
      paramCount++;
      updates.push(`end_year = $${paramCount}`);
      params.push(endYear);
    }
    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
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

    const query = `UPDATE batches SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2 RETURNING *`;

    const result = await db.query(query, params);

    return res.status(200).json({
      batch: result.rows[0],
    });
  } catch (error) {
    console.error("Update batch error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while updating batch",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// DELETE /api/batches/:id
async function deleteBatch(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { id } = req.params;

    // Authorization
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can delete batches",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if batch exists
    const existing = await db.query(
      "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Batch does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check for referential integrity (classes or students)
    const classCheck = await db.query(
      "SELECT COUNT(*) as count FROM classes WHERE batch_id = $1",
      [id],
    );

    if (parseInt(classCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete batch with existing classes",
          details: {
            classCount: parseInt(classCheck.rows[0].count),
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    await db.query("DELETE FROM batches WHERE id = $1 AND tenant_id = $2", [
      id,
      tenantId,
    ]);

    return res.status(204).send();
  } catch (error) {
    console.error("Delete batch error:", error);

    // Handle foreign key constraint violations
    if (error.code === "23503") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete batch due to existing references",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while deleting batch",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = {
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
};

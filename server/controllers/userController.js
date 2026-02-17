const { nanoid } = require("nanoid");
const bcrypt = require("bcrypt");
const db = require("../config/database");

// GET /api/users
async function getUsers(req, res) {
  try {
    const { tenantId, roles } = req.context;
    const { role, search } = req.query;

    // Authorization: Only Admin
    if (!roles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can view users",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    let query = `SELECT id, name, email, roles, created_at FROM users WHERE tenant_id = $1`;
    const params = [tenantId];
    let paramCount = 1;

    // Filter by role
    if (role) {
      paramCount++;
      // Use JSONB containment operator
      query += ` AND roles @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([role]));
    }

    // Search by name or email
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY name ASC`;

    const result = await db.query(query, params);

    return res.status(200).json({
      users: result.rows,
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching users",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// POST /api/users
async function createUser(req, res) {
  try {
    const { tenantId, roles: currentUserRoles } = req.context;
    const { name, email, password, roles } = req.body;

    // Authorization: Only Admin
    if (!currentUserRoles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can create users",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validation
    if (!name || !email || !password || !roles) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "name, email, password, and roles are required",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid email format",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Password must be at least 8 characters",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate roles array
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "roles must be a non-empty array",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Validate role values
    const validRoles = ["Teacher", "Admin"];
    const invalidRoles = roles.filter((r) => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid role(s): " + invalidRoles.join(", "),
          details: { validRoles },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Deduplicate roles
    const uniqueRoles = [...new Set(roles)];

    // Check if email already exists
    const existingUser = await db.query(
      "SELECT id FROM users WHERE tenant_id = $1 AND email = $2",
      [tenantId, email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Email already exists for this school",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_ROUNDS) || 10,
    );

    const id = nanoid(10);

    const result = await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id, name, email, roles, created_at`,
      [id, tenantId, name, email, passwordHash, JSON.stringify(uniqueRoles)],
    );

    return res.status(201).json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// PUT /api/users/:id
async function updateUser(req, res) {
  try {
    const { tenantId, roles: currentUserRoles } = req.context;
    const { id } = req.params;
    const { name, email, password, roles } = req.body;

    // Authorization: Only Admin
    if (!currentUserRoles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can update users",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if user exists
    const existing = await db.query(
      "SELECT id FROM users WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If email is being changed, check for duplicates
    if (email) {
      const emailCheck = await db.query(
        "SELECT id FROM users WHERE tenant_id = $1 AND email = $2 AND id != $3",
        [tenantId, email, id],
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: {
            code: "CONFLICT",
            message: "Email already exists for another user",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Validate roles if provided
    if (roles) {
      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "roles must be a non-empty array",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }

      const validRoles = ["Teacher", "Admin"];
      const invalidRoles = roles.filter((r) => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid role(s): " + invalidRoles.join(", "),
            details: { validRoles },
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
    if (email !== undefined) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email);
    }
    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Password must be at least 8 characters",
            details: {},
            timestamp: new Date().toISOString(),
          },
        });
      }
      const passwordHash = await bcrypt.hash(
        password,
        parseInt(process.env.BCRYPT_ROUNDS) || 10,
      );
      paramCount++;
      updates.push(`password_hash = $${paramCount}`);
      params.push(passwordHash);
    }
    if (roles !== undefined) {
      const uniqueRoles = [...new Set(roles)];
      paramCount++;
      updates.push(`roles = $${paramCount}::jsonb`);
      params.push(JSON.stringify(uniqueRoles));
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

    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2 RETURNING id, name, email, roles, updated_at`;

    const result = await db.query(query, params);

    return res.status(200).json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while updating user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// DELETE /api/users/:id
async function deleteUser(req, res) {
  try {
    const { tenantId, roles: currentUserRoles } = req.context;
    const { id } = req.params;

    // Authorization: Only Admin
    if (!currentUserRoles.includes("Admin")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Admin can delete users",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check if user exists
    const existing = await db.query(
      "SELECT id FROM users WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User does not exist",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Check for timeslot references (RESTRICT constraint)
    const timeslotCheck = await db.query(
      "SELECT COUNT(*) as count FROM time_slots WHERE teacher_id = $1",
      [id],
    );

    if (parseInt(timeslotCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete user with existing timeslot assignments",
          details: {
            timeslotCount: parseInt(timeslotCheck.rows[0].count),
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    await db.query("DELETE FROM users WHERE id = $1 AND tenant_id = $2", [
      id,
      tenantId,
    ]);

    return res.status(204).send();
  } catch (error) {
    console.error("Delete user error:", error);

    // Handle foreign key constraint violations
    if (error.code === "23503") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot delete user due to existing references",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while deleting user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};

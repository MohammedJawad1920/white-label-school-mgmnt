const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db = require("../config/database");

async function login(req, res) {
  try {
    const { email, password, tenantSlug } = req.body;

    // 1. Validate inputs
    if (!email || !password || !tenantSlug) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "email, password, and tenantSlug are required",
      });
    }

    // 2. Look up tenant by slug
    const tenantResult = await db.query(
      "SELECT id FROM tenants WHERE slug = $1 ",
      [tenantSlug],
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        error: "TENANT_NOT_FOUND",
        message: "Tenant does not exist",
      });
    }

    const tenantId = tenantResult.rows[0].id;

    // 3. Look up user in that tenant
    const userResult = await db.query(
      "SELECT id, name, email, password_hash, roles FROM users WHERE tenant_id = $1 AND  email = $2",
      [tenantId, email],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials",
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials",
      });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: tenantId,
        roles: user.roles,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "365d" },
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        tenantId: tenantId,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An error occurred during login",
    });
  }
}

module.exports = { login };

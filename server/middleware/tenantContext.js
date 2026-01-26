const jwt = require("jsonwebtoken");

function tenantContextMiddleware(req, res, next) {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.header.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // 2. Verify and decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check if tenantId exists in token
    if (!decoded.tenantId) {
      throw new Error("JWT missing tenantId - security violation");
    }

    // 4. Attach tenant context to request
    req.context = {
      tenantId: decoded.tenantId,
      userId: decoded.userId,
      roles: decoded.roles,
    };

    // 5. Proceed to next middleware/handler
    next();
  } catch (err) {
    // Token invalid, expired, or missing tenantId
    if (err.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Token expired" });
    }
    // Other errors (like missing tenantId)
    return res
      .status(401)
      .json({ error: "UNAUTHORIZED", message: err.message });
  }
}

module.exports = tenantContextMiddleware;

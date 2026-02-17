const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
} = require("../controllers/classController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// GET /api/classes
router.get("/", getClasses);

// POST /api/classes
router.post("/", createClass);

// PUT /api/classes/:id
router.put("/:id", updateClass);

// DELETE /api/classes/:id
router.delete("/:id", deleteClass);

module.exports = router;

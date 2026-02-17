const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// GET /api/users
router.get("/", getUsers);

// POST /api/users
router.post("/", createUser);

// PUT /api/users/:id
router.put("/:id", updateUser);

// DELETE /api/users/:id
router.delete("/:id", deleteUser);

module.exports = router;

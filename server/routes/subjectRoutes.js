const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} = require("../controllers/subjectController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// GET /api/subjects
router.get("/", getSubjects);

// POST /api/subjects
router.post("/", createSubject);

// PUT /api/subjects/:id
router.put("/:id", updateSubject);

// DELETE /api/subjects/:id
router.delete("/:id", deleteSubject);

module.exports = router;

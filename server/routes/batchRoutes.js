const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
} = require("../controllers/batchController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// GET /api/batches
router.get("/", getBatches);

// POST /api/batches
router.post("/", createBatch);

// PUT /api/batches/:id
router.put("/:id", updateBatch);

// DELETE /api/batches/:id
router.delete("/:id", deleteBatch);

module.exports = router;

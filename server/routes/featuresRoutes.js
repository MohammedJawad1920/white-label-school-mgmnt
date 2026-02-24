const express = require("express");
const tenantContextMiddleware = require("../middleware/tenantContext");
const {
  getFeatures,
  updateFeature,
} = require("../controllers/featuresController");

const router = express.Router();

// All routes require authentication
router.use(tenantContextMiddleware);

// GET /api/features
router.get("/", getFeatures);

// PUT /api/features/:featureKey
router.put("/:featureKey", updateFeature);

module.exports = router;

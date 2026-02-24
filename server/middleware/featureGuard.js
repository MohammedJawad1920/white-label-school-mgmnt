const db = require("../config/database");

/**
 * Middleware to check if a feature is enabled for the tenant
 * Usage: router.use(requireFeature("timetable"));
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    const { tenantId } = req;

    if (!tenantId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Tenant context not found",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    try {
      // Check if feature is enabled for this tenant
      const result = await db.query(
        `SELECT enabled 
         FROM tenant_features 
         WHERE tenant_id = $1 AND feature_key = $2`,
        [tenantId, featureKey],
      );

      const isEnabled = result.rows[0]?.enabled || false;

      if (!isEnabled) {
        // Get feature name for better error message
        const featureResult = await db.query(
          "SELECT name FROM features WHERE key = $1",
          [featureKey],
        );

        const featureName = featureResult.rows[0]?.name || featureKey;

        return res.status(403).json({
          error: {
            code: "FEATURE_DISABLED",
            message: `${featureName} feature is not enabled for this school`,
            details: { featureKey, featureName },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Feature is enabled, proceed
      next();
    } catch (error) {
      console.error(`Error checking feature ${featureKey}:`, error);
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to verify feature access",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
};

module.exports = { requireFeature };

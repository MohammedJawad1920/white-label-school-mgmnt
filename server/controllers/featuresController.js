const db = require("../config/database");

/**
 * GET /api/features
 * List enabled features for current tenant
 */
exports.getFeatures = async (req, res) => {
  try {
    const { tenantId } = req.context;

    const featuresQuery = `
      SELECT 
        f.key,
        f.name,
        f.description,
        COALESCE(tf.enabled, false) as enabled,
        tf.enabled_at
      FROM features f
      LEFT JOIN tenant_features tf 
        ON tf.feature_key = f.key 
        AND tf.tenant_id = $1
      ORDER BY f.key
    `;

    const result = await db.query(featuresQuery, [tenantId]);

    res.json({
      features: result.rows.map((row) => ({
        key: row.key,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        enabledAt: row.enabled_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching features:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch features",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * PUT /api/features/:featureKey
 * Enable or disable a feature module
 */
exports.updateFeature = async (req, res) => {
  try {
    const { tenantId } = req.context;
    const { featureKey } = req.params;
    const { enabled } = req.body;

    // Validate input
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "enabled must be a boolean",
          details: { field: "enabled", value: enabled },
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify feature exists
    const featureCheck = await db.query(
      "SELECT key, name FROM features WHERE key = $1",
      [featureKey],
    );

    if (featureCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Feature '${featureKey}' does not exist`,
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
    }

    // CRITICAL: Check dependency - attendance requires timetable
    if (featureKey === "attendance" && enabled === true) {
      const timetableCheck = await db.query(
        "SELECT enabled FROM tenant_features WHERE tenant_id = $1 AND feature_key = $2",
        [tenantId, "timetable"],
      );

      const timetableEnabled = timetableCheck.rows[0]?.enabled || false;

      if (!timetableEnabled) {
        return res.status(400).json({
          error: {
            code: "DEPENDENCY_ERROR",
            message: "Attendance module requires Timetable to be enabled first",
            details: { required: "timetable", requested: "attendance" },
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // CRITICAL: If disabling timetable, auto-disable attendance
    if (featureKey === "timetable" && enabled === false) {
      await db.query(
        `UPDATE tenant_features 
         SET enabled = false, enabled_at = NULL 
         WHERE tenant_id = $1 AND feature_key = $2`,
        [tenantId, "attendance"],
      );
    }

    // Upsert tenant_features record
    const upsertQuery = `
      INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
      VALUES (
        'TF' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
        $1,
        $2,
        $3,
        CASE WHEN $3 = true THEN NOW() ELSE NULL END
      )
      ON CONFLICT (tenant_id, feature_key)
      DO UPDATE SET 
        enabled = $3,
        enabled_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END
      RETURNING *
    `;

    const result = await db.query(upsertQuery, [tenantId, featureKey, enabled]);

    res.json({
      feature: {
        key: result.rows[0].feature_key,
        enabled: result.rows[0].enabled,
        enabledAt: result.rows[0].enabled_at,
      },
    });
  } catch (error) {
    console.error("Error updating feature:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update feature",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
  }
};

const db = require("../config/database");
const bcrypt = require("bcrypt");
require("dotenv").config();

/**
 * Phase 5: Multi-Tenancy Setup
 * Creates a second test tenant (School B) with complete test data
 * to validate tenant isolation
 */

async function setupSecondTenant() {
  try {
    console.log("🏫 Phase 5: Multi-Tenancy Setup");
    console.log("================================\n");

    // Step 1: Create second tenant
    console.log("Step 1: Creating second tenant (School B)...");

    await db.query(
      `INSERT INTO tenants (id, name, slug, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      ["T002", "Green Valley High School", "greenvalley"],
    );
    console.log("✅ Tenant created: T002 (greenvalley)\n");

    // Step 2: Enable features for School B
    console.log("Step 2: Enabling features for School B...");

    await db.query(
      `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
       VALUES ('TF003', 'T002', 'timetable', true, NOW())
       ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true`,
    );

    await db.query(
      `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
       VALUES ('TF004', 'T002', 'attendance', true, NOW())
       ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true`,
    );
    console.log("✅ Features enabled (timetable, attendance)\n");

    // Step 3: Create admin and teacher for School B
    console.log("Step 3: Creating users for School B...");

    const passwordHash = await bcrypt.hash("admin123", 10);

    await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL)
       ON CONFLICT DO NOTHING`,
      [
        "U201",
        "T002",
        "Sarah Johnson",
        "admin@greenvalley.com",
        passwordHash,
        JSON.stringify(["Admin"]),
      ],
    );
    console.log("✅ Admin created: admin@greenvalley.com");

    await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL)
       ON CONFLICT DO NOTHING`,
      [
        "U202",
        "T002",
        "Michael Chen",
        "teacher1@greenvalley.com",
        passwordHash,
        JSON.stringify(["Teacher"]),
      ],
    );
    console.log("✅ Teacher 1 created: teacher1@greenvalley.com");

    await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL)
       ON CONFLICT DO NOTHING`,
      [
        "U203",
        "T002",
        "Emily Davis",
        "teacher2@greenvalley.com",
        passwordHash,
        JSON.stringify(["Teacher"]),
      ],
    );
    console.log("✅ Teacher 2 created: teacher2@greenvalley.com\n");

    // Step 4: Create batch
    console.log("Step 4: Creating batch for School B...");

    await db.query(
      `INSERT INTO batches (id, tenant_id, name, start_year, end_year, status, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT DO NOTHING`,
      ["B201", "T002", "2025-2026", 2025, 2026, "Active"],
    );
    console.log("✅ Batch created: 2025-2026\n");

    // Step 5: Create subjects
    console.log("Step 5: Creating subjects for School B...");

    const subjects = [
      ["SUB201", "T002", "English", "ENG"],
      ["SUB202", "T002", "Science", "SCI"],
      ["SUB203", "T002", "History", "HIST"],
    ];

    for (const [id, tenantId, name, code] of subjects) {
      await db.query(
        `INSERT INTO subjects (id, tenant_id, name, code, deleted_at)
         VALUES ($1, $2, $3, $4, NULL)
         ON CONFLICT DO NOTHING`,
        [id, tenantId, name, code],
      );
      console.log(`✅ Subject created: ${name} (${code})`);
    }
    console.log();

    // Step 6: Create classes
    console.log("Step 6: Creating classes for School B...");

    const classes = [
      ["C201", "T002", "Grade 9A", "B201"],
      ["C202", "T002", "Grade 9B", "B201"],
    ];

    for (const [id, tenantId, name, batchId] of classes) {
      await db.query(
        `INSERT INTO classes (id, tenant_id, name, batch_id, deleted_at)
         VALUES ($1, $2, $3, $4, NULL)
         ON CONFLICT DO NOTHING`,
        [id, tenantId, name, batchId],
      );
      console.log(`✅ Class created: ${name}`);
    }
    console.log();

    // Step 7: Create students
    console.log("Step 7: Creating students for School B...");

    const students = [
      // Grade 9A students
      ["S201", "T002", "Alice Brown", "C201", "B201"],
      ["S202", "T002", "Bob Wilson", "C201", "B201"],
      ["S203", "T002", "Carol Martinez", "C201", "B201"],
      ["S204", "T002", "David Lee", "C201", "B201"],
      ["S205", "T002", "Emma Garcia", "C201", "B201"],
      // Grade 9B students
      ["S206", "T002", "Frank Anderson", "C202", "B201"],
      ["S207", "T002", "Grace Taylor", "C202", "B201"],
      ["S208", "T002", "Henry Thomas", "C202", "B201"],
    ];

    for (const [id, tenantId, name, classId, batchId] of students) {
      await db.query(
        `INSERT INTO students (id, tenant_id, name, class_id, batch_id, deleted_at)
         VALUES ($1, $2, $3, $4, $5, NULL)
         ON CONFLICT DO NOTHING`,
        [id, tenantId, name, classId, batchId],
      );
    }
    console.log(`✅ ${students.length} students created\n`);

    // Step 8: Create timetable entries
    console.log("Step 8: Creating timetable for School B...");

    const timetable = [
      // Monday - Grade 9A
      [
        "TS201",
        "T002",
        "C201",
        "SUB201",
        "U202",
        "Monday",
        1,
        "09:00",
        "09:45",
        "2026-02-01",
      ],
      [
        "TS202",
        "T002",
        "C201",
        "SUB202",
        "U203",
        "Monday",
        2,
        "09:50",
        "10:35",
        "2026-02-01",
      ],
      // Monday - Grade 9B
      [
        "TS203",
        "T002",
        "C202",
        "SUB201",
        "U203",
        "Monday",
        1,
        "09:00",
        "09:45",
        "2026-02-01",
      ],
      [
        "TS204",
        "T002",
        "C202",
        "SUB203",
        "U202",
        "Monday",
        2,
        "09:50",
        "10:35",
        "2026-02-01",
      ],
    ];

    for (const [
      id,
      tenantId,
      classId,
      subjectId,
      teacherId,
      day,
      period,
      start,
      end,
      effectiveFrom,
    ] of timetable) {
      await db.query(
        `INSERT INTO time_slots (id, tenant_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, effective_from, effective_to, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NULL)
         ON CONFLICT DO NOTHING`,
        [
          id,
          tenantId,
          classId,
          subjectId,
          teacherId,
          day,
          period,
          start,
          end,
          effectiveFrom,
        ],
      );
    }
    console.log(`✅ ${timetable.length} time_slots created\n`);

    // Verification
    console.log("📊 Verification Summary:");
    console.log("========================\n");

    const counts = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE tenant_id = 'T002' AND deleted_at IS NULL) as users,
        (SELECT COUNT(*) FROM batches WHERE tenant_id = 'T002' AND deleted_at IS NULL) as batches,
        (SELECT COUNT(*) FROM subjects WHERE tenant_id = 'T002' AND deleted_at IS NULL) as subjects,
        (SELECT COUNT(*) FROM classes WHERE tenant_id = 'T002' AND deleted_at IS NULL) as classes,
        (SELECT COUNT(*) FROM students WHERE tenant_id = 'T002' AND deleted_at IS NULL) as students,
        (SELECT COUNT(*) FROM time_slots WHERE tenant_id = 'T002' AND deleted_at IS NULL) as time_slots`,
    );

    const stats = counts.rows[0];
    console.log(`Users:     ${stats.users}`);
    console.log(`Batches:   ${stats.batches}`);
    console.log(`Subjects:  ${stats.subjects}`);
    console.log(`Classes:   ${stats.classes}`);
    console.log(`Students:  ${stats.students}`);
    console.log(`Time_slots: ${stats.timeslots}`);

    console.log("\n✅ School B setup complete!\n");
    console.log("Login credentials:");
    console.log("==================");
    console.log("Tenant Slug: greenvalley");
    console.log("Admin:   admin@greenvalley.com / admin123");
    console.log("Teacher: teacher1@greenvalley.com / admin123");
    console.log("Teacher: teacher2@greenvalley.com / admin123\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error setting up second tenant:");
    console.error(error);
    process.exit(1);
  }
}

setupSecondTenant();

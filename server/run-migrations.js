require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "src/db/migrations");

const migrations = [
  "001_initial_schema.sql",
  "002_add_student_user_id.sql",
  "003_add_attendance_corrections.sql",
  "004_student_admission_dob.sql",
  "005_tenant_timezone.sql",
  "006_student_status_classid_nullable.sql",
  "007_batch_status_graduated.sql",
  "008_timeslot_remove_effective_dates.sql",
  "009_academic_calendar_events.sql",
  "010_users_token_version.sql",
  "011_users_must_change_password.sql",
  "012_attendance_records_update.sql",
  "013_academic_sessions.sql",
  "014_batches_entry_level.sql",
  "015_classes_session_level_section.sql",
  "016_students_enrollment_dates.sql",
  "017_tenants_school_profile.sql",
  "018_tenants_uuid_primary_key.sql",
  "019_leave_requests.sql",
  "020_guardians.sql",
  "021_student_guardians.sql",
  "022_push_subscriptions.sql",
  "023_notifications.sql",
  "024_events_check_session_id.sql",
  "025_promotion_logs_v5.sql",
  "026_promotion_previews_v5.sql",
  "027_exams.sql",
  "028_exam_subjects.sql",
  "029_exam_results.sql",
  "030_exam_student_summaries.sql",
  "031_external_results.sql",
  "032_fee_charges.sql",
  "033_fee_payments.sql",
  "034_announcements.sql",
  "035_import_jobs.sql",
  "036_tenants_profile_note.sql",
  "037_assignments.sql",
  "038_assignment_submissions.sql",
  "039_entity_ids_to_uuid.sql",
];

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected.");

  for (const file of migrations) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    try {
      await client.query(sql);
      console.log("OK:", file);
    } catch (err) {
      console.error("FAIL:", file);
      console.error("  ", err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("All migrations applied successfully.");
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

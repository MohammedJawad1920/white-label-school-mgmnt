/**
 * Cron Service (v5.0)
 *
 * Scheduled background jobs for:
 * 1. Leave overdue detection (every 30 minutes)
 * 2. Announcement push dispatch (every 1 minute)
 * 3. Preview/import job cleanup (every 15 minutes)
 * 4. Absence streak alert (daily at 09:00 tenant timezone)
 *
 * Started from server.ts after DB pool is ready.
 * Graceful shutdown via stopAllJobs().
 */

import { pool } from "../db/pool";
import { logger } from "../utils/logger";
import { sendPushToUser } from "./push.service";

const timers: NodeJS.Timeout[] = [];

function scheduleInterval(
  name: string,
  fn: () => Promise<void>,
  intervalMs: number,
): void {
  const run = async (): Promise<void> => {
    try {
      await fn();
    } catch (err) {
      logger.error({ err, job: name }, "Cron job failed");
    }
  };
  const timer = setInterval(run, intervalMs);
  timers.push(timer);
  logger.info({ job: name, intervalMs }, "Cron job registered");
}

// ─── Job 1: Leave Overdue Detection ──────────────────────────────────────────

async function detectOverdueLeaves(): Promise<void> {
  // Transition ACTIVE leaves past expected_return_at to OVERDUE
  const { rows: overdue } = await pool.query<{
    id: string;
    tenant_id: string;
    student_id: string;
    student_name: string;
  }>(
    `UPDATE leave_requests lr
     SET status = 'OVERDUE', updated_at = NOW()
     FROM students s
     WHERE lr.student_id = s.id
       AND lr.status = 'ACTIVE'
       AND lr.expected_return_at < NOW()
     RETURNING lr.id, lr.tenant_id, lr.student_id, s.name AS student_name`,
  );

  if (overdue.length === 0) return;

  logger.info({ count: overdue.length }, "Marked leaves as OVERDUE");

  // Push notify admins + class teachers for each overdue leave
  for (const leave of overdue) {
    try {
      // Notify admin users of tenant
      const { rows: admins } = await pool.query<{ id: string }>(
        `SELECT id FROM users
         WHERE tenant_id = $1
           AND $2 = ANY(roles)
           AND deleted_at IS NULL`,
        [leave.tenant_id, "Admin"],
      );

      const pushPromises = admins.map((admin) =>
        sendPushToUser(admin.id, leave.tenant_id, {
          type: "LEAVE_OVERDUE",
          title: "Student Overdue",
          body: `${leave.student_name} has not returned from leave.`,
          route: "/admin/leave",
        }),
      );

      await Promise.allSettled(pushPromises);

      // Insert in-app notification for admins
      if (admins.length > 0) {
        const values = admins
          .map(
            (_, i) =>
              `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, 'LEAVE_OVERDUE', 'Student Overdue', '${leave.student_name} has not returned from leave.')`,
          )
          .join(", ");
        const params = admins.flatMap((admin) => [
          crypto.randomUUID(),
          leave.tenant_id,
          admin.id,
          JSON.stringify({ leaveId: leave.id }),
        ]);

        await pool.query(
          `INSERT INTO notifications (id, tenant_id, user_id, data, type, title, body) VALUES ${values}`,
          params,
        );
      }
    } catch (err) {
      logger.error(
        { err, leaveId: leave.id },
        "Failed to process overdue leave notification",
      );
    }
  }
}

// ─── Job 2: Announcement Push Dispatch ───────────────────────────────────────

async function dispatchAnnouncementPush(): Promise<void> {
  const { rows: announcements } = await pool.query<{
    id: string;
    tenant_id: string;
    title: string;
    body: string;
    audience_type: string;
    audience_class_id: string | null;
    audience_batch_id: string | null;
  }>(
    `UPDATE announcements
     SET push_sent = true, updated_at = NOW()
     WHERE publish_at <= NOW()
       AND push_sent = false
       AND (expires_at IS NULL OR expires_at > NOW())
     RETURNING id, tenant_id, title, body, audience_type, audience_class_id, audience_batch_id`,
  );

  if (announcements.length === 0) return;

  logger.info(
    { count: announcements.length },
    "Dispatching announcement push notifications",
  );

  for (const ann of announcements) {
    try {
      // Get target user IDs based on audience_type
      let userQuery: string;
      let userParams: unknown[];

      if (ann.audience_type === "All") {
        userQuery = `SELECT id FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`;
        userParams = [ann.tenant_id];
      } else if (ann.audience_type === "StudentsOnly") {
        userQuery = `SELECT id FROM users WHERE tenant_id = $1 AND 'Student' = ANY(roles) AND deleted_at IS NULL`;
        userParams = [ann.tenant_id];
      } else if (ann.audience_type === "TeachersOnly") {
        userQuery = `SELECT id FROM users WHERE tenant_id = $1 AND 'Teacher' = ANY(roles) AND deleted_at IS NULL`;
        userParams = [ann.tenant_id];
      } else if (ann.audience_type === "GuardiansOnly") {
        userQuery = `SELECT id FROM users WHERE tenant_id = $1 AND 'Guardian' = ANY(roles) AND deleted_at IS NULL`;
        userParams = [ann.tenant_id];
      } else if (ann.audience_type === "Class" && ann.audience_class_id) {
        userQuery = `SELECT DISTINCT u.id FROM users u
          JOIN students s ON s.user_id = u.id
          WHERE s.class_id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL AND s.deleted_at IS NULL`;
        userParams = [ann.audience_class_id, ann.tenant_id];
      } else if (ann.audience_type === "Batch" && ann.audience_batch_id) {
        userQuery = `SELECT DISTINCT u.id FROM users u
          JOIN students s ON s.user_id = u.id
          WHERE s.batch_id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL AND s.deleted_at IS NULL`;
        userParams = [ann.audience_batch_id, ann.tenant_id];
      } else {
        continue;
      }

      const { rows: users } = await pool.query<{ id: string }>(
        userQuery,
        userParams,
      );

      await Promise.allSettled(
        users.map((u) =>
          sendPushToUser(u.id, ann.tenant_id, {
            type: "ANNOUNCEMENT",
            title: ann.title,
            body: ann.body.slice(0, 120),
            route: "/announcements",
          }),
        ),
      );
    } catch (err) {
      logger.error(
        { err, announcementId: ann.id },
        "Failed to dispatch announcement push",
      );
    }
  }
}

// ─── Job 3: Preview / Import Cleanup ─────────────────────────────────────────

async function cleanupExpiredPreviews(): Promise<void> {
  const { rowCount: promoCount } = await pool.query(
    `DELETE FROM promotion_previews WHERE expires_at < NOW()`,
  );
  const { rowCount: importCount } = await pool.query(
    `DELETE FROM import_jobs WHERE expires_at < NOW() AND status = 'PREVIEW'`,
  );
  if ((promoCount ?? 0) > 0 || (importCount ?? 0) > 0) {
    logger.info({ promoCount, importCount }, "Cleaned up expired previews");
  }
}

// ─── Job 4: Absence Streak Alert (runs every 60 min, logic checks time) ──────

async function absenceStreakAlert(): Promise<void> {
  // Check if current hour is 09:00 in any tenant timezone (approximate)
  const now = new Date();
  if (now.getUTCHours() !== 9) return; // Simple UTC approximation

  // Find students with 3+ consecutive absent days in their attendances
  const { rows } = await pool.query<{
    student_id: string;
    tenant_id: string;
    student_name: string;
    absent_days: number;
  }>(
    `SELECT ar.student_id, ar.tenant_id, s.name AS student_name,
            COUNT(*) AS absent_days
     FROM attendance_records ar
     JOIN students s ON ar.student_id = s.id
     WHERE ar.status = 'Absent'
       AND ar.date >= (CURRENT_DATE - INTERVAL '3 days')
       AND ar.date < CURRENT_DATE
     GROUP BY ar.student_id, ar.tenant_id, s.name
     HAVING COUNT(DISTINCT ar.date) >= 3`,
  );

  for (const row of rows) {
    try {
      // Get guardian user IDs
      const { rows: guardians } = await pool.query<{ user_id: string }>(
        `SELECT g.user_id FROM guardians g
         JOIN student_guardians sg ON sg.guardian_id = g.id
         WHERE sg.student_id = $1 AND sg.tenant_id = $2
           AND g.user_id IS NOT NULL AND g.deleted_at IS NULL`,
        [row.student_id, row.tenant_id],
      );

      await Promise.allSettled(
        guardians.map((g) =>
          sendPushToUser(g.user_id, row.tenant_id, {
            type: "ABSENCE_ALERT",
            title: "Attendance Alert",
            body: `${row.student_name} has been absent for ${row.absent_days} consecutive days.`,
            route: "/guardian/attendance",
          }),
        ),
      );
    } catch (err) {
      logger.error(
        { err, studentId: row.student_id },
        "Failed to send absence streak alert",
      );
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startAllJobs(): void {
  scheduleInterval("leave-overdue", detectOverdueLeaves, 30 * 60 * 1000);
  scheduleInterval("announcement-push", dispatchAnnouncementPush, 60 * 1000);
  scheduleInterval("preview-cleanup", cleanupExpiredPreviews, 15 * 60 * 1000);
  scheduleInterval("absence-streak", absenceStreakAlert, 60 * 60 * 1000);
  logger.info({ event: "cron_jobs_started" }, "All cron jobs started");
}

export function stopAllJobs(): void {
  for (const timer of timers) {
    clearInterval(timer);
  }
  timers.length = 0;
  logger.info({ event: "cron_jobs_stopped" }, "All cron jobs stopped");
}

/**
 * Auth Controller — Tenant Auth
 *
 * POST /api/v1/auth/login           — tenant user login (requires tenantId UUID)
 * POST /api/v1/auth/logout          — increments token_version → revokes all existing JWTs
 * POST /api/v1/auth/switch-role     — re-issue JWT with new activeRole (reads roles from DB)
 * POST /api/v1/auth/change-password — change password; resets must_change_password flag
 *
 * CRITICAL: switch-role reads roles from DB, NOT from the JWT.
 * Freeze §7 Phase 3: "POST /auth/switch-role reads `roles` from DB, not JWT"
 */

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../db/pool";
import { config } from "../../config/env";
import { send400, send401, send404, send422 } from "../../utils/errors";
import {
  UserRow,
  StudentRow,
  TenantRow,
  UserRole,
  TenantJwtPayload,
} from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTokenPayload(
  user: Pick<
    UserRow,
    "id" | "tenant_id" | "roles" | "token_version" | "must_change_password"
  >,
  activeRole: UserRole,
  studentId: string | null,
  classTeacherOf: string | null,
): TenantJwtPayload {
  return {
    userId: user.id,
    tenantId: user.tenant_id,
    roles: user.roles,
    activeRole,
    studentId,
    tokenVersion: user.token_version,
    mustChangePassword: user.must_change_password,
    classTeacherOf,
  };
}

function formatUser(
  u: Pick<
    UserRow,
    "id" | "tenant_id" | "name" | "email" | "roles" | "must_change_password"
  >,
  activeRole: UserRole,
  studentId: string | null,
  classTeacherOf: string | null,
) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    activeRole,
    studentId,
    mustChangePassword: u.must_change_password,
    classTeacherOf,
  };
}

// CR-38: Resolve studentId for Student-role logins.
async function resolveStudentId(
  userId: string,
  tenantId: string,
  activeRole: UserRole,
): Promise<string | null> {
  if (activeRole !== "Student") return null;
  const result = await pool.query<Pick<StudentRow, "id">>(
    `SELECT id FROM students
     WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [userId, tenantId],
  );
  return result.rows[0]?.id ?? null;
}

// v5.0: Resolve classTeacherOf — classId of the class this user is teacher for
// in the currently ACTIVE session. Returns null if no such assignment exists.
async function resolveClassTeacherOf(
  userId: string,
  tenantId: string,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT c.id
     FROM classes c
     JOIN academic_sessions s
       ON s.id = c.session_id
      AND s.tenant_id = $2
      AND s.status = 'ACTIVE'
      AND s.deleted_at IS NULL
     WHERE c.class_teacher_id = $1
       AND c.tenant_id = $2
       AND c.deleted_at IS NULL
     LIMIT 1`,
    [userId, tenantId],
  );
  return result.rows[0]?.id ?? null;
}

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────

export async function tenantLogin(req: Request, res: Response): Promise<void> {
  const { email, password, tenantId } = req.body as {
    email?: string;
    password?: string;
    tenantId?: string;
  };

  // CR-19: string check only — student loginIds (e.g. 530@school.local) are
  // pseudo-emails that would fail standard email validation.
  if (!email || typeof email !== "string" || email.trim().length === 0) {
    send422(res, "email is required");
    return;
  }
  if (
    !password ||
    typeof password !== "string" ||
    password.trim().length === 0
  ) {
    send422(res, "password is required");
    return;
  }
  if (
    !tenantId ||
    typeof tenantId !== "string" ||
    tenantId.trim().length === 0
  ) {
    send422(res, "tenantId is required");
    return;
  }
  if (password.length < 8) {
    send422(res, "password must be at least 8 characters");
    return;
  }

  const tenantResult = await pool.query<Pick<TenantRow, "id" | "status">>(
    "SELECT id, status FROM tenants WHERE id = $1 AND deleted_at IS NULL",
    [tenantId.trim()],
  );
  const tenant = tenantResult.rows[0];

  if (!tenant) {
    send404(res, "Tenant does not exist");
    return;
  }
  if (tenant.status !== "active") {
    res.status(403).json({
      error: {
        code: "TENANT_INACTIVE",
        message: "Tenant is inactive",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const userResult = await pool.query<UserRow>(
    `SELECT id, tenant_id, name, email, password_hash, roles,
            token_version, must_change_password,
            deleted_at, created_at, updated_at
     FROM users
     WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [email.toLowerCase().trim(), tenant.id],
  );
  const user = userResult.rows[0];

  // Timing-safe: always bcrypt even when user not found
  const hashToCompare =
    user?.password_hash ?? "$2b$10$invalidhashpaddingtopreventimingoracles";
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !valid) {
    send401(res, "Invalid credentials");
    return;
  }

  const activeRole = user.roles[0] as UserRole;
  const [studentId, classTeacherOf] = await Promise.all([
    resolveStudentId(user.id, tenant.id, activeRole),
    resolveClassTeacherOf(user.id, tenant.id),
  ]);

  const payload = buildTokenPayload(
    user,
    activeRole,
    studentId,
    classTeacherOf,
  );
  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(200).json({
    token,
    user: formatUser(user, activeRole, studentId, classTeacherOf),
  });
}

// ─── POST /api/v1/auth/logout ────────────────────────────────────────────────
// v5.0: increments token_version — invalidates all existing JWTs for this user.

export async function tenantLogout(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const tenantId = req.tenantId!;

  await pool.query(
    `UPDATE users
     SET token_version = token_version + 1, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [userId, tenantId],
  );

  res.status(204).send();
}

// ─── POST /api/v1/auth/switch-role ───────────────────────────────────────────

export async function switchRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role?: string };
  const userId = req.userId!;
  const tenantId = req.tenantId!;

  if (!role) {
    send400(res, "role is required");
    return;
  }
  const validSwitchRoles: string[] = [
    "Teacher",
    "Admin",
    "Student",
    "Guardian",
  ];
  if (!validSwitchRoles.includes(role)) {
    res.status(400).json({
      error: {
        code: "ROLE_NOT_ASSIGNED",
        message: "Requested role is not assigned to this user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // CRITICAL: Read from DB — not from JWT
  const userResult = await pool.query<UserRow>(
    `SELECT id, tenant_id, name, email, roles, token_version, must_change_password
     FROM users
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [userId, tenantId],
  );
  const user = userResult.rows[0];

  if (!user) {
    send404(res, "User not found");
    return;
  }
  if (user.roles.length < 2) {
    res.status(403).json({
      error: {
        code: "SINGLE_ROLE_USER",
        message: "User has only one role; switching not applicable",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }
  if (!user.roles.includes(role as UserRole)) {
    res.status(400).json({
      error: {
        code: "ROLE_NOT_ASSIGNED",
        message: "Requested role is not assigned to this user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const newActiveRole = role as UserRole;
  const [studentId, classTeacherOf] = await Promise.all([
    resolveStudentId(user.id, user.tenant_id, newActiveRole),
    resolveClassTeacherOf(user.id, user.tenant_id),
  ]);

  const payload = buildTokenPayload(
    user,
    newActiveRole,
    studentId,
    classTeacherOf,
  );
  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(200).json({
    token,
    user: formatUser(user, newActiveRole, studentId, classTeacherOf),
  });
}

// ─── POST /api/v1/auth/change-password ───────────────────────────────────────
// v5.0: changes password, resets must_change_password, increments token_version,
// and returns a fresh JWT so the client session is seamlessly continued.

export async function changePassword(
  req: Request,
  res: Response,
): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  const userId = req.userId!;
  const tenantId = req.tenantId!;

  if (!currentPassword || typeof currentPassword !== "string") {
    send422(res, "currentPassword is required");
    return;
  }
  if (!newPassword || typeof newPassword !== "string") {
    send422(res, "newPassword is required");
    return;
  }
  if (newPassword.length < 8) {
    send422(res, "newPassword must be at least 8 characters", "VALIDATION_ERROR", {
      field: "newPassword",
      minLength: 8,
    });
    return;
  }

  const userResult = await pool.query<UserRow>(
    `SELECT id, tenant_id, name, email, password_hash, roles,
            token_version, must_change_password
     FROM users
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [userId, tenantId],
  );
  const user = userResult.rows[0];

  if (!user) {
    send404(res, "User not found");
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    send400(res, "Current password is incorrect", "INCORRECT_PASSWORD");
    return;
  }

  const newHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);
  const updated = await pool.query<Pick<UserRow, "token_version">>(
    `UPDATE users
     SET password_hash = $1,
         must_change_password = false,
         token_version = token_version + 1,
         updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING token_version`,
    [newHash, userId, tenantId],
  );

  const newTokenVersion = updated.rows[0]!.token_version;
  const activeRole = req.activeRole ?? (user.roles[0] as UserRole);
  const [studentId, classTeacherOf] = await Promise.all([
    resolveStudentId(user.id, user.tenant_id, activeRole),
    resolveClassTeacherOf(user.id, user.tenant_id),
  ]);

  const freshUser: UserRow = {
    ...user,
    must_change_password: false,
    token_version: newTokenVersion,
  };
  const payload = buildTokenPayload(
    freshUser,
    activeRole,
    studentId,
    classTeacherOf,
  );
  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(200).json({
    token,
    user: formatUser(freshUser, activeRole, studentId, classTeacherOf),
  });
}

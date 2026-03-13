/**
 * School Profile Controller (v5.0)
 *
 * Manages school-level branding and profile information stored on the tenants table.
 *
 * GET  /school-profile         — read profile (Admin, Teacher, Student, Guardian)
 * PUT  /school-profile         — update profile (Admin only)
 * POST /school-profile/upload  — upload logo or signature to R2 (Admin only)
 */

import { Request, Response } from "express";
import { pool } from "../../db/pool";
import { send400, send403, sendError } from "../../utils/errors";
import { TenantRow, ApiSchoolProfile } from "../../types";
import { isR2Configured, uploadFile } from "../../services/r2-storage.service";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_UPLOAD_TYPES = ["logo", "signature"] as const;
type UploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

// H-02: Corrected enum values to match StudentLevel in OpenAPI (Degree1/2/3 not DegreeY1/2/3; PG1/2 not PGY1/2)
const VALID_LEVELS = [
  "Std8",
  "Std9",
  "Std10",
  "PlusOne",
  "PlusTwo",
  "Degree1",
  "Degree2",
  "Degree3",
  "PG1",
  "PG2",
];

function formatProfile(row: TenantRow): ApiSchoolProfile {
  return {
    tenantId: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? null,
    address: row.address ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    brandingColor: row.branding_color ?? null,
    principalName: row.principal_name ?? null,
    principalSignatureUrl: row.principal_signature_url ?? null,
    activeLevels: row.active_levels ?? null,
  };
}

// ─── GET /school-profile ─────────────────────────────────────────────────────

export async function getProfile(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;

  const result = await pool.query<TenantRow>(
    `SELECT id, name, slug, logo_url, address, phone, email, website,
            branding_color, principal_name, principal_signature_url,
            active_levels, status, timezone, deactivated_at, created_at, updated_at
     FROM tenants WHERE id = $1`,
    [tenantId],
  );

  const tenant = result.rows[0];
  if (!tenant) {
    sendError(res, {
      code: "NOT_FOUND",
      message: "Tenant not found",
      status: 404,
    });
    return;
  }

  res.json({ profile: formatProfile(tenant) });
}

// ─── PUT /school-profile ─────────────────────────────────────────────────────

export async function updateProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;

  const {
    logoUrl,
    address,
    phone,
    email,
    website,
    brandingColor,
    principalName,
    principalSignatureUrl,
    activeLevels,
  } = req.body as {
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    brandingColor?: string | null;
    principalName?: string | null;
    principalSignatureUrl?: string | null;
    activeLevels?: string[] | null;
  };

  // Validate branding color if provided
  if (brandingColor !== undefined && brandingColor !== null) {
    if (!HEX_COLOR_RE.test(brandingColor)) {
      send400(res, "brandingColor must be a 6-digit hex color (e.g. #1A5276)");
      return;
    }
  }

  // Validate activeLevels if provided
  if (activeLevels !== undefined && activeLevels !== null) {
    if (!Array.isArray(activeLevels)) {
      send400(res, "activeLevels must be an array");
      return;
    }
    const invalid = activeLevels.filter((l) => !VALID_LEVELS.includes(l));
    if (invalid.length > 0) {
      send400(
        res,
        `Invalid level(s): ${invalid.join(", ")}. Valid values: ${VALID_LEVELS.join(", ")}`,
      );
      return;
    }
  }

  // Build SET clause dynamically — only update provided fields
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  function addField(column: string, value: unknown) {
    updates.push(`${column} = $${paramIdx++}`);
    values.push(value);
  }

  if (logoUrl !== undefined) addField("logo_url", logoUrl);
  if (address !== undefined) addField("address", address);
  if (phone !== undefined) addField("phone", phone);
  if (email !== undefined) addField("email", email);
  if (website !== undefined) addField("website", website);
  if (brandingColor !== undefined) addField("branding_color", brandingColor);
  if (principalName !== undefined) addField("principal_name", principalName);
  if (principalSignatureUrl !== undefined)
    addField("principal_signature_url", principalSignatureUrl);
  if (activeLevels !== undefined) addField("active_levels", activeLevels);

  if (updates.length === 0) {
    send400(res, "No fields provided to update");
    return;
  }

  updates.push(`updated_at = NOW()`);
  values.push(tenantId);

  const result = await pool.query<TenantRow>(
    `UPDATE tenants
     SET ${updates.join(", ")}
     WHERE id = $${paramIdx}
     RETURNING id, name, slug, logo_url, address, phone, email, website,
               branding_color, principal_name, principal_signature_url,
               active_levels, status, timezone, deactivated_at, created_at, updated_at`,
    values,
  );

  res.json({ profile: formatProfile(result.rows[0]!) });
}

// ─── POST /school-profile/upload ─────────────────────────────────────────────
// Accepts multipart/form-data with fields: type (logo|signature) + file
// Uses multer (configured in routes.ts) to parse the upload.

export async function uploadProfileFile(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;

  if (!isR2Configured()) {
    sendError(res, {
      code: "FEATURE_DISABLED",
      message: "File uploads are not configured on this server",
      status: 503,
    });
    return;
  }

  const { type } = req.body as { type?: string };
  if (!type || !ALLOWED_UPLOAD_TYPES.includes(type as UploadType)) {
    send400(res, `type must be one of: ${ALLOWED_UPLOAD_TYPES.join(", ")}`);
    return;
  }

  const file = req.file;
  if (!file) {
    send400(res, "No file provided");
    return;
  }

  // Restrict to images only
  if (!file.mimetype.startsWith("image/")) {
    send400(res, "Only image files are accepted");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    send400(res, "File size must not exceed 2 MB");
    return;
  }

  const ext = file.originalname.split(".").pop() ?? "bin";
  const key = `tenants/${tenantId}/${type as UploadType}-${Date.now()}.${ext}`;

  const url = await uploadFile(key, file.buffer, file.mimetype);

  // M-04: OpenAPI specifies HTTP 200 for this endpoint (not 201)
  res.json({ url });
}

/**
 * bulkSoftDelete — Shared partial-success bulk delete helper
 *
 * WHY no wrapping transaction:
 * Freeze §7 Phase 4 explicitly requires partial success. If we wrapped the
 * whole thing in a transaction, one FK violation would roll back all
 * successful deletes. Each record is attempted independently.
 *
 * WHY max 100:
 * Prevents accidental full-table wipes and keeps per-request DB time bounded.
 *
 * @param pool     - pg Pool
 * @param table    - table name (safe: only called with literal strings)
 * @param ids      - array of IDs to soft-delete
 * @param tenantId - caller's tenantId (tenant isolation)
 * @param refCheck - optional fn that returns a reason string if the record
 *                   has blocking references, or null if safe to delete
 */

import { Pool } from "pg";
import { BulkDeleteResult } from "../types";

type RefCheckFn = (
  id: string,
  tenantId: string,
  pool: Pool,
) => Promise<string | null>;

export async function bulkSoftDelete(
  pool: Pool,
  table: string,
  ids: string[],
  tenantId: string,
  refCheck?: RefCheckFn,
): Promise<BulkDeleteResult> {
  const deleted: string[] = [];
  const failed: BulkDeleteResult["failed"] = [];

  for (const id of ids) {
    // 1. Verify record exists and belongs to this tenant
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );

    if ((existing.rowCount ?? 0) === 0) {
      failed.push({ id, reason: "NOT_FOUND", message: "Record not found" });
      continue;
    }

    // 2. Check for blocking references if a checker was provided
    if (refCheck) {
      const reason = await refCheck(id, tenantId, pool);
      if (reason) {
        failed.push({ id, reason: "HAS_REFERENCES", message: reason });
        continue;
      }
    }

    // 3. Soft delete
    await pool.query(
      `UPDATE ${table} SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    deleted.push(id);
  }

  return { deleted, failed };
}

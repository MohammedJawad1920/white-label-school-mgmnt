#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Batches CRUD
#   GET    /batches
#   POST   /batches
#   PUT    /batches/:id
#   DELETE /batches/:id
#   DELETE /batches/bulk
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERROR: ADMIN_TOKEN not found. Run bootstrap first."
  exit 1
fi

UID_SUFFIX=$(unique_id)

section "Batches — CREATE"

# ── 1. Create batch ──
api_call POST "/batches" \
  "{\"name\":\"Batch ${UID_SUFFIX}\",\"startYear\":2026,\"endYear\":2027}" \
  "$ADMIN_TOKEN"
assert_status "Create batch" "201" || true
assert_json_key "Create batch — id" ".batch.id" || true
assert_json_key "Create batch — name" ".batch.name" || true
assert_json_key "Create batch — status" ".batch.status" || true

BATCH_ID=$(json_body ".batch.id" || true)
save_state "BATCH_ID" "$BATCH_ID"

# ── 2. Create second batch (for class/student tests later) ──
api_call POST "/batches" \
  "{\"name\":\"Batch2 ${UID_SUFFIX}\",\"startYear\":2025,\"endYear\":2026}" \
  "$ADMIN_TOKEN"
assert_status "Create second batch" "201" || true
BATCH_ID_2=$(json_body ".batch.id" || true)
save_state "BATCH_ID_2" "$BATCH_ID_2"

# ── 3. Create batch — missing fields → 400 ──
api_call POST "/batches" \
  '{"name":"No years"}' "$ADMIN_TOKEN"
assert_status "Create batch — missing fields → 400" "400" || true

# ── 4. Create batch — no auth → 401 ──
api_call POST "/batches" \
  '{"name":"NoAuth","startYear":2026,"endYear":2027}'
assert_status "Create batch — no auth → 401" "401" || true

# ── 5. Create batch — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/batches" \
    '{"name":"Forbidden","startYear":2026,"endYear":2027}' "$TEACHER_TOKEN"
  assert_status "Create batch — Teacher → 403" "403" || true
fi

section "Batches — LIST"

# ── 6. List batches ──
api_call GET "/batches" "" "$ADMIN_TOKEN"
assert_status "List batches" "200" || true
assert_json_key "List batches — array present" ".batches" || true

# ── 7. List batches — no auth → 401 ──
api_call GET "/batches" ""
assert_status "List batches — no auth → 401" "401" || true

section "Batches — UPDATE"

# ── 8. Update batch name ──
if [[ -n "$BATCH_ID" ]]; then
  api_call PUT "/batches/${BATCH_ID}" \
    '{"name":"Updated Batch Name"}' "$ADMIN_TOKEN"
  assert_status "Update batch name" "200" || true
  assert_json_key "Update batch — name" ".batch.name" || true
fi

# ── 9. Update batch status to Archived ──
if [[ -n "$BATCH_ID_2" ]]; then
  api_call PUT "/batches/${BATCH_ID_2}" \
    '{"status":"Archived"}' "$ADMIN_TOKEN"
  assert_status "Update batch — archive" "200" || true

  # Restore to Active for later tests
  api_call PUT "/batches/${BATCH_ID_2}" \
    '{"status":"Active"}' "$ADMIN_TOKEN"
fi

# ── 10. Update batch — not found → 404 ──
api_call PUT "/batches/NONEXIST" \
  '{"name":"Ghost"}' "$ADMIN_TOKEN"
assert_status "Update batch — not found → 404" "404" || true

section "Batches — DELETE"

# Create a batch specifically for deletion
api_call POST "/batches" \
  "{\"name\":\"DeleteMe\",\"startYear\":2024,\"endYear\":2025}" "$ADMIN_TOKEN"
DEL_BATCH_ID=$(json_body ".batch.id" || true)

# ── 11. Delete batch ──
if [[ -n "$DEL_BATCH_ID" ]]; then
  api_call DELETE "/batches/${DEL_BATCH_ID}" "" "$ADMIN_TOKEN"
  assert_status "Delete batch" "204" || true
fi

# ── 12. Delete batch — not found → 404 ──
api_call DELETE "/batches/NONEXIST" "" "$ADMIN_TOKEN"
assert_status "Delete batch — not found → 404" "404" || true

section "Batches — BULK DELETE"

BULK_IDS=()
for i in 1 2; do
  api_call POST "/batches" \
    "{\"name\":\"BulkBatch${i}\",\"startYear\":2024,\"endYear\":2025}" "$ADMIN_TOKEN"
  ID=$(json_body ".batch.id" || true)
  if [[ -n "$ID" ]]; then
    BULK_IDS+=("\"$ID\"")
  fi
done

if [[ ${#BULK_IDS[@]} -ge 2 ]]; then
  IDS_JSON=$(IFS=,; echo "${BULK_IDS[*]}")
  # ── 13. Bulk delete batches ──
  api_call DELETE "/batches/bulk" \
    "{\"ids\":[${IDS_JSON}]}" "$ADMIN_TOKEN"
  assert_status "Bulk delete batches" "200" || true
  assert_json_key "Bulk delete — deleted array" ".deleted" || true
fi

# ── 14. Bulk delete — empty → 400 ──
api_call DELETE "/batches/bulk" \
  '{"ids":[]}' "$ADMIN_TOKEN"
assert_status "Bulk delete — empty → 400" "400" || true

print_summary "Batches"

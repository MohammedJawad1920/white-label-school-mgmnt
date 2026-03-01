#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Classes CRUD
#   GET    /classes
#   POST   /classes
#   PUT    /classes/:id
#   DELETE /classes/:id
#   DELETE /classes/bulk
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")
BATCH_ID=$(get_state "BATCH_ID")

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERROR: ADMIN_TOKEN not found. Run bootstrap first."
  exit 1
fi

if [[ -z "$BATCH_ID" ]]; then
  echo "ERROR: BATCH_ID not found. Run test-batches.sh first."
  exit 1
fi

UID_SUFFIX=$(unique_id)

section "Classes — CREATE"

# ── 1. Create class ──
api_call POST "/classes" \
  "{\"name\":\"Grade 10A ${UID_SUFFIX}\",\"batchId\":\"${BATCH_ID}\"}" \
  "$ADMIN_TOKEN"
assert_status "Create class" "201" || true
assert_json_key "Create class — id" ".class.id" || true
assert_json_key "Create class — name" ".class.name" || true
assert_json_key "Create class — batchId" ".class.batchId" || true

CLASS_ID=$(json_body ".class.id" || true)
save_state "CLASS_ID" "$CLASS_ID"

# ── 2. Create second class ──
api_call POST "/classes" \
  "{\"name\":\"Grade 10B ${UID_SUFFIX}\",\"batchId\":\"${BATCH_ID}\"}" \
  "$ADMIN_TOKEN"
assert_status "Create second class" "201" || true
CLASS_ID_2=$(json_body ".class.id" || true)
save_state "CLASS_ID_2" "$CLASS_ID_2"

# ── 3. Create class — missing batchId → 400 ──
api_call POST "/classes" \
  '{"name":"No Batch"}' "$ADMIN_TOKEN"
assert_status "Create class — missing batchId → 400" "400" || true

# ── 4. Create class — no auth → 401 ──
api_call POST "/classes" \
  "{\"name\":\"NoAuth\",\"batchId\":\"${BATCH_ID}\"}"
assert_status "Create class — no auth → 401" "401" || true

# ── 5. Create class — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/classes" \
    "{\"name\":\"Forbidden\",\"batchId\":\"${BATCH_ID}\"}" "$TEACHER_TOKEN"
  assert_status "Create class — Teacher → 403" "403" || true
fi

section "Classes — LIST"

# ── 6. List classes ──
api_call GET "/classes" "" "$ADMIN_TOKEN"
assert_status "List classes" "200" || true
assert_json_key "List classes — array present" ".classes" || true

# ── 7. List classes — no auth → 401 ──
api_call GET "/classes" ""
assert_status "List classes — no auth → 401" "401" || true

section "Classes — UPDATE"

# ── 8. Update class name ──
if [[ -n "$CLASS_ID" ]]; then
  api_call PUT "/classes/${CLASS_ID}" \
    '{"name":"Updated Grade 10A"}' "$ADMIN_TOKEN"
  assert_status "Update class name" "200" || true
  assert_json_key "Update class — name" ".class.name" || true
fi

# ── 9. Update class — not found → 404 ──
api_call PUT "/classes/NONEXIST" \
  '{"name":"Ghost"}' "$ADMIN_TOKEN"
assert_status "Update class — not found → 404" "404" || true

section "Classes — DELETE"

# Create a class for deletion
api_call POST "/classes" \
  "{\"name\":\"DeleteMe\",\"batchId\":\"${BATCH_ID}\"}" "$ADMIN_TOKEN"
DEL_CLASS_ID=$(json_body ".class.id" || true)

# ── 10. Delete class ──
if [[ -n "$DEL_CLASS_ID" ]]; then
  api_call DELETE "/classes/${DEL_CLASS_ID}" "" "$ADMIN_TOKEN"
  assert_status "Delete class" "204" || true
fi

# ── 11. Delete class — not found → 404 ──
api_call DELETE "/classes/NONEXIST" "" "$ADMIN_TOKEN"
assert_status "Delete class — not found → 404" "404" || true

section "Classes — BULK DELETE"

BULK_IDS=()
for i in 1 2; do
  api_call POST "/classes" \
    "{\"name\":\"BulkClass${i}\",\"batchId\":\"${BATCH_ID}\"}" "$ADMIN_TOKEN"
  ID=$(json_body ".class.id" || true)
  if [[ -n "$ID" ]]; then
    BULK_IDS+=("\"$ID\"")
  fi
done

if [[ ${#BULK_IDS[@]} -ge 2 ]]; then
  IDS_JSON=$(IFS=,; echo "${BULK_IDS[*]}")
  # ── 12. Bulk delete classes ──
  api_call DELETE "/classes/bulk" \
    "{\"ids\":[${IDS_JSON}]}" "$ADMIN_TOKEN"
  assert_status "Bulk delete classes" "200" || true
  assert_json_key "Bulk delete — deleted array" ".deleted" || true
fi

# ── 13. Bulk delete — empty → 400 ──
api_call DELETE "/classes/bulk" \
  '{"ids":[]}' "$ADMIN_TOKEN"
assert_status "Bulk delete — empty → 400" "400" || true

print_summary "Classes"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Subjects CRUD
#   GET    /subjects
#   POST   /subjects
#   PUT    /subjects/:id
#   DELETE /subjects/:id
#   DELETE /subjects/bulk
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

section "Subjects — CREATE"

# ── 1. Create subject ──
api_call POST "/subjects" \
  "{\"name\":\"Mathematics ${UID_SUFFIX}\",\"code\":\"MATH${UID_SUFFIX}\"}" \
  "$ADMIN_TOKEN"
assert_status "Create subject" "201" || true
assert_json_key "Create subject — id" ".subject.id" || true
assert_json_key "Create subject — name" ".subject.name" || true

SUBJECT_ID=$(json_body ".subject.id" || true)
save_state "SUBJECT_ID" "$SUBJECT_ID"

# ── 2. Create subject without code ──
api_call POST "/subjects" \
  "{\"name\":\"Science ${UID_SUFFIX}\"}" "$ADMIN_TOKEN"
assert_status "Create subject (no code)" "201" || true
SUBJECT_ID_2=$(json_body ".subject.id" || true)
save_state "SUBJECT_ID_2" "$SUBJECT_ID_2"

# ── 3. Create subject — missing name → 400 ──
api_call POST "/subjects" \
  '{"code":"NONAME"}' "$ADMIN_TOKEN"
assert_status "Create subject — missing name → 400" "400" || true

# ── 4. Create subject — no auth → 401 ──
api_call POST "/subjects" \
  '{"name":"NoAuth","code":"NA"}'
assert_status "Create subject — no auth → 401" "401" || true

# ── 5. Create subject — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/subjects" \
    '{"name":"Forbidden","code":"FB"}' "$TEACHER_TOKEN"
  assert_status "Create subject — Teacher → 403" "403" || true
fi

section "Subjects — LIST"

# ── 6. List subjects ──
api_call GET "/subjects" "" "$ADMIN_TOKEN"
assert_status "List subjects" "200" || true
assert_json_key "List subjects — array present" ".subjects" || true

# ── 7. List subjects — no auth → 401 ──
api_call GET "/subjects" ""
assert_status "List subjects — no auth → 401" "401" || true

section "Subjects — UPDATE"

# ── 8. Update subject name ──
if [[ -n "$SUBJECT_ID" ]]; then
  api_call PUT "/subjects/${SUBJECT_ID}" \
    '{"name":"Updated Math","code":"UMATH"}' "$ADMIN_TOKEN"
  assert_status "Update subject" "200" || true
  assert_json_key "Update subject — name" ".subject.name" || true
fi

# ── 9. Update subject — not found → 404 ──
api_call PUT "/subjects/NONEXIST" \
  '{"name":"Ghost"}' "$ADMIN_TOKEN"
assert_status "Update subject — not found → 404" "404" || true

section "Subjects — DELETE"

# Create for delete test
api_call POST "/subjects" \
  "{\"name\":\"DeleteMe ${UID_SUFFIX}\"}" "$ADMIN_TOKEN"
DEL_SUBJ_ID=$(json_body ".subject.id" || true)

# ── 10. Delete subject ──
if [[ -n "$DEL_SUBJ_ID" ]]; then
  api_call DELETE "/subjects/${DEL_SUBJ_ID}" "" "$ADMIN_TOKEN"
  assert_status "Delete subject" "204" || true
fi

# ── 11. Delete subject — not found → 404 ──
api_call DELETE "/subjects/NONEXIST" "" "$ADMIN_TOKEN"
assert_status "Delete subject — not found → 404" "404" || true

section "Subjects — BULK DELETE"

BULK_IDS=()
for i in 1 2; do
  api_call POST "/subjects" \
    "{\"name\":\"BulkSubj${i} ${UID_SUFFIX}\"}" "$ADMIN_TOKEN"
  ID=$(json_body ".subject.id" || true)
  if [[ -n "$ID" ]]; then
    BULK_IDS+=("\"$ID\"")
  fi
done

if [[ ${#BULK_IDS[@]} -ge 2 ]]; then
  IDS_JSON=$(IFS=,; echo "${BULK_IDS[*]}")
  # ── 12. Bulk delete subjects ──
  api_call DELETE "/subjects/bulk" \
    "{\"ids\":[${IDS_JSON}]}" "$ADMIN_TOKEN"
  assert_status "Bulk delete subjects" "200" || true
  assert_json_key "Bulk delete — deleted array" ".deleted" || true
fi

# ── 13. Bulk delete — empty → 400 ──
api_call DELETE "/subjects/bulk" \
  '{"ids":[]}' "$ADMIN_TOKEN"
assert_status "Bulk delete — empty → 400" "400" || true

print_summary "Subjects"

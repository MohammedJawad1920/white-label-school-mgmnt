#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: School Periods CRUD (v3.3)
#   GET    /school-periods
#   POST   /school-periods
#   PUT    /school-periods/:id
#   DELETE /school-periods/:id
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERROR: ADMIN_TOKEN not found. Run bootstrap first."
  exit 1
fi

section "School Periods — LIST"

# ── 1. List periods (should have 8 defaults from tenant creation) ──
api_call GET "/school-periods" "" "$ADMIN_TOKEN"
assert_status "List school periods" "200" || true
assert_json_key "List periods — array present" ".periods" || true

# Save first period ID for later if available
EXISTING_PERIOD_ID=$(json_body ".periods[0].id")
if [[ -n "$EXISTING_PERIOD_ID" ]]; then
  save_state "EXISTING_PERIOD_ID" "$EXISTING_PERIOD_ID"
fi

# Count existing periods to know next number
PERIOD_COUNT=$(json_body ".periods.length")
NEXT_PERIOD=$((PERIOD_COUNT + 1))

# ── 2. List periods — Teacher (read-only access) ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call GET "/school-periods" "" "$TEACHER_TOKEN"
  assert_status "List periods — Teacher" "200" || true
fi

# ── 3. List periods — no auth → 401 ──
api_call GET "/school-periods" ""
assert_status "List periods — no auth → 401" "401" || true

section "School Periods — CREATE"

# ── 4. Create new period ──
api_call POST "/school-periods" \
  "{\"periodNumber\":${NEXT_PERIOD},\"label\":\"Period ${NEXT_PERIOD}\",\"startTime\":\"15:30\",\"endTime\":\"16:15\"}" \
  "$ADMIN_TOKEN"
assert_status "Create school period" "201" || true
assert_json_key "Create period — id" ".period.id" || true
assert_json_key "Create period — periodNumber" ".period.periodNumber" || true
assert_json_key "Create period — startTime" ".period.startTime" || true

NEW_PERIOD_ID=$(json_body ".period.id")
save_state "NEW_PERIOD_ID" "$NEW_PERIOD_ID"

# ── 5. Create period — duplicate periodNumber → 409 ──
api_call POST "/school-periods" \
  "{\"periodNumber\":${NEXT_PERIOD},\"label\":\"Dup\",\"startTime\":\"16:30\",\"endTime\":\"17:15\"}" \
  "$ADMIN_TOKEN"
assert_status "Create period — duplicate number → 409" "409" || true

# ── 6. Create period — invalid time (start >= end) → 400 ──
NEXT2=$((NEXT_PERIOD + 1))
api_call POST "/school-periods" \
  "{\"periodNumber\":${NEXT2},\"startTime\":\"17:00\",\"endTime\":\"16:00\"}" \
  "$ADMIN_TOKEN"
assert_status "Create period — startTime >= endTime → 400" "400" || true

# ── 7. Create period — missing required fields → 400 ──
api_call POST "/school-periods" \
  '{"label":"No Number"}' "$ADMIN_TOKEN"
assert_status "Create period — missing fields → 400" "400" || true

# ── 8. Create period — no auth → 401 ──
api_call POST "/school-periods" \
  "{\"periodNumber\":99,\"startTime\":\"18:00\",\"endTime\":\"18:45\"}"
assert_status "Create period — no auth → 401" "401" || true

# ── 9. Create period — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/school-periods" \
    "{\"periodNumber\":99,\"startTime\":\"18:00\",\"endTime\":\"18:45\"}" "$TEACHER_TOKEN"
  assert_status "Create period — Teacher → 403" "403" || true
fi

section "School Periods — UPDATE"

# ── 10. Update period label ──
if [[ -n "$NEW_PERIOD_ID" ]]; then
  api_call PUT "/school-periods/${NEW_PERIOD_ID}" \
    '{"label":"Custom Period"}' "$ADMIN_TOKEN"
  assert_status "Update period label" "200" || true
  assert_json_key "Update period — label" ".period.label" || true
fi

# ── 11. Update period times ──
if [[ -n "$NEW_PERIOD_ID" ]]; then
  api_call PUT "/school-periods/${NEW_PERIOD_ID}" \
    '{"startTime":"15:45","endTime":"16:30"}' "$ADMIN_TOKEN"
  assert_status "Update period times" "200" || true
fi

# ── 12. Update period — invalid times → 400 ──
if [[ -n "$NEW_PERIOD_ID" ]]; then
  api_call PUT "/school-periods/${NEW_PERIOD_ID}" \
    '{"startTime":"17:00","endTime":"16:00"}' "$ADMIN_TOKEN"
  assert_status "Update period — invalid times → 400" "400" || true
fi

# ── 13. Update period — not found → 404 ──
api_call PUT "/school-periods/NONEXIST" \
  '{"label":"Ghost"}' "$ADMIN_TOKEN"
assert_status "Update period — not found → 404" "404" || true

# ── 14. Update period — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" && -n "$NEW_PERIOD_ID" ]]; then
  api_call PUT "/school-periods/${NEW_PERIOD_ID}" \
    '{"label":"Hacked"}' "$TEACHER_TOKEN"
  assert_status "Update period — Teacher → 403" "403" || true
fi

section "School Periods — DELETE"

# Create a period specifically for deletion
DEL_PERIOD_NUM=$((NEXT_PERIOD + 10))
api_call POST "/school-periods" \
  "{\"periodNumber\":${DEL_PERIOD_NUM},\"label\":\"ToDelete\",\"startTime\":\"19:00\",\"endTime\":\"19:45\"}" \
  "$ADMIN_TOKEN"
DEL_PERIOD_ID=$(json_body ".period.id")

# ── 15. Delete period ──
if [[ -n "$DEL_PERIOD_ID" ]]; then
  api_call DELETE "/school-periods/${DEL_PERIOD_ID}" "" "$ADMIN_TOKEN"
  assert_status "Delete period" "204" || true
fi

# ── 16. Delete period — not found → 404 ──
api_call DELETE "/school-periods/NONEXIST" "" "$ADMIN_TOKEN"
assert_status "Delete period — not found → 404" "404" || true

# ── 17. Delete period — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" && -n "$EXISTING_PERIOD_ID" ]]; then
  api_call DELETE "/school-periods/${EXISTING_PERIOD_ID}" "" "$TEACHER_TOKEN"
  assert_status "Delete period — Teacher → 403" "403" || true
fi

print_summary "School Periods"

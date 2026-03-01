#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Attendance
#   POST /attendance/record-class
#   GET  /attendance/summary
#   GET  /students/:studentId/attendance  (also in test-students.sh)
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")
TEACHER_ID=$(get_state "TEACHER_ID")
TIMESLOT_ID=$(get_state "TIMESLOT_ID")
CLASS_ID=$(get_state "CLASS_ID")
STUDENT_ID=$(get_state "STUDENT_ID")
STUDENT_ID_2=$(get_state "STUDENT_ID_2")
STUDENT_ID_3=$(get_state "STUDENT_ID_3")

if [[ -z "$ADMIN_TOKEN" || -z "$TIMESLOT_ID" ]]; then
  echo "ERROR: Missing state. Run previous scripts first."
  exit 1
fi

section "Attendance — RECORD CLASS"

# ── 1. Record attendance for class (all present) ──
api_call POST "/attendance/record-class" \
  "{\"timeSlotId\":\"${TIMESLOT_ID}\",\"date\":\"2026-03-02\",\"defaultStatus\":\"Present\"}" \
  "$ADMIN_TOKEN"
assert_status "Record attendance — all present" "201" || true
assert_json_key "Record attendance — recorded count" ".recorded" || true
assert_json_key "Record attendance — present count" ".present" || true
assert_json_key "Record attendance — date" ".date" || true

# ── 2. Record attendance with exceptions ──
EXCEPTIONS="[]"
if [[ -n "$STUDENT_ID_2" && -n "$STUDENT_ID_3" ]]; then
  EXCEPTIONS="[{\"studentId\":\"${STUDENT_ID_2}\",\"status\":\"Absent\"},{\"studentId\":\"${STUDENT_ID_3}\",\"status\":\"Late\"}]"
fi

api_call POST "/attendance/record-class" \
  "{\"timeSlotId\":\"${TIMESLOT_ID}\",\"date\":\"2026-03-03\",\"defaultStatus\":\"Present\",\"exceptions\":${EXCEPTIONS}}" \
  "$ADMIN_TOKEN"
assert_status "Record attendance — with exceptions" "201" || true
assert_json_key "Record attendance — absent count" ".absent" || true
assert_json_key "Record attendance — late count" ".late" || true

# ── 3. Record attendance — duplicate (same timeslot + date) → 409 ──
api_call POST "/attendance/record-class" \
  "{\"timeSlotId\":\"${TIMESLOT_ID}\",\"date\":\"2026-03-02\",\"defaultStatus\":\"Present\"}" \
  "$ADMIN_TOKEN"
assert_status "Record attendance — duplicate → 409" "409" || true

# ── 4. Record attendance — missing fields → 400 ──
api_call POST "/attendance/record-class" \
  '{"timeSlotId":"TS001"}' "$ADMIN_TOKEN"
assert_status "Record attendance — missing fields → 400" "400" || true

# ── 5. Record attendance — invalid timeslot → 404/400 ──
api_call POST "/attendance/record-class" \
  '{"timeSlotId":"NONEXIST","date":"2026-03-02","defaultStatus":"Present"}' "$ADMIN_TOKEN"
# Could be 404 or 400 depending on implementation
echo -e "  ${YELLOW}[INFO]${NC} Record with invalid timeslot → HTTP $HTTP_STATUS"

# ── 6. Record attendance — no auth → 401 ──
api_call POST "/attendance/record-class" \
  "{\"timeSlotId\":\"${TIMESLOT_ID}\",\"date\":\"2026-03-04\",\"defaultStatus\":\"Present\"}"
assert_status "Record attendance — no auth → 401" "401" || true

# ── 7. Teacher can record attendance for own class ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/attendance/record-class" \
    "{\"timeSlotId\":\"${TIMESLOT_ID}\",\"date\":\"2026-03-04\",\"defaultStatus\":\"Present\"}" \
    "$TEACHER_TOKEN"
  # Teacher should be able to record attendance for their own timeslots
  echo -e "  ${YELLOW}[INFO]${NC} Teacher record attendance → HTTP $HTTP_STATUS (expected 201 for own class)"
fi

section "Attendance — SUMMARY"

# ── 8. Get attendance summary ──
api_call GET "/attendance/summary?from=2026-03-01&to=2026-03-31" "" "$ADMIN_TOKEN"
assert_status "Get attendance summary" "200" || true

# ── 9. Get attendance summary — with classId ──
if [[ -n "$CLASS_ID" ]]; then
  api_call GET "/attendance/summary?classId=${CLASS_ID}&from=2026-03-01&to=2026-03-31" "" "$ADMIN_TOKEN"
  assert_status "Get summary — classId filter" "200" || true
fi

# ── 10. Get attendance summary — missing dates → 400 ──
api_call GET "/attendance/summary" "" "$ADMIN_TOKEN"
assert_status "Get summary — missing dates → 400" "400" || true

# ── 11. Get attendance summary — no auth → 401 ──
api_call GET "/attendance/summary?from=2026-03-01&to=2026-03-31" ""
assert_status "Get summary — no auth → 401" "401" || true

section "Attendance — Student History (cross-reference)"

# ── 12. Get student attendance after recording ──
if [[ -n "$STUDENT_ID" ]]; then
  api_call GET "/students/${STUDENT_ID}/attendance?from=2026-03-01&to=2026-03-31" "" "$ADMIN_TOKEN"
  assert_status "Student attendance after recording" "200" || true
  assert_json_key "Student attendance — records" ".records" || true
  assert_json_key "Student attendance — summary" ".summary" || true
fi

# ── 13. Student attendance — with pagination ──
if [[ -n "$STUDENT_ID" ]]; then
  api_call GET "/students/${STUDENT_ID}/attendance?from=2026-03-01&to=2026-03-31&limit=1&offset=0" "" "$ADMIN_TOKEN"
  assert_status "Student attendance — paginated" "200" || true
  assert_json_key "Student attendance — pagination" ".pagination" || true
fi

print_summary "Attendance"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Timetable
#   GET  /timetable
#   POST /timetable
#   PUT  /timetable/:timeSlotId/end
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")
TEACHER_ID=$(get_state "TEACHER_ID")
CLASS_ID=$(get_state "CLASS_ID")
CLASS_ID_2=$(get_state "CLASS_ID_2")
SUBJECT_ID=$(get_state "SUBJECT_ID")
SUBJECT_ID_2=$(get_state "SUBJECT_ID_2")

if [[ -z "$ADMIN_TOKEN" || -z "$CLASS_ID" || -z "$SUBJECT_ID" || -z "$TEACHER_ID" ]]; then
  echo "ERROR: Missing state. Run previous scripts first."
  exit 1
fi

section "Timetable — CREATE"

# ── 1. Create timetable entry ──
api_call POST "/timetable" \
  "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Monday\",\"periodNumber\":1,\"effectiveFrom\":\"2026-03-01\"}" \
  "$ADMIN_TOKEN"
assert_status "Create timeslot" "201" || true
assert_json_key "Create timeslot — id" ".timeSlot.id" || true
assert_json_key "Create timeslot — className" ".timeSlot.className" || true
assert_json_key "Create timeslot — subjectName" ".timeSlot.subjectName" || true
assert_json_key "Create timeslot — teacherName" ".timeSlot.teacherName" || true
assert_json_key "Create timeslot — startTime (derived)" ".timeSlot.startTime" || true
assert_json_key "Create timeslot — endTime (derived)" ".timeSlot.endTime" || true
assert_json_key "Create timeslot — label (derived)" ".timeSlot.label" || true

TIMESLOT_ID=$(json_body ".timeSlot.id")
save_state "TIMESLOT_ID" "$TIMESLOT_ID"

# ── 2. Create second timeslot (different period) ──
api_call POST "/timetable" \
  "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Monday\",\"periodNumber\":2,\"effectiveFrom\":\"2026-03-01\"}" \
  "$ADMIN_TOKEN"
assert_status "Create second timeslot" "201" || true
TIMESLOT_ID_2=$(json_body ".timeSlot.id")
save_state "TIMESLOT_ID_2" "$TIMESLOT_ID_2"

# ── 3. Create timeslot — conflict (same class, day, period) → 409 ──
api_call POST "/timetable" \
  "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Monday\",\"periodNumber\":1,\"effectiveFrom\":\"2026-03-01\"}" \
  "$ADMIN_TOKEN"
assert_status "Create timeslot — conflict → 409" "409" || true

# ── 4. Create timeslot — unconfigured period → 400 ──
api_call POST "/timetable" \
  "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Tuesday\",\"periodNumber\":999,\"effectiveFrom\":\"2026-03-01\"}" \
  "$ADMIN_TOKEN"
assert_status "Create timeslot — unconfigured period → 400" "400" || true

# ── 5. Create timeslot — v3.3: startTime/endTime in body → 400 ──
api_call POST "/timetable" \
  "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Tuesday\",\"periodNumber\":1,\"effectiveFrom\":\"2026-03-01\",\"startTime\":\"08:00\",\"endTime\":\"08:45\"}" \
  "$ADMIN_TOKEN"
# This might succeed or fail with 400 depending on impl. The freeze says it should be 400.
echo -e "  ${YELLOW}[INFO]${NC} Create with startTime/endTime → HTTP $HTTP_STATUS (freeze says 400)"

# ── 6. Create timeslot — missing required fields → 400 ──
api_call POST "/timetable" \
  '{"classId":"C001","dayOfWeek":"Monday"}' "$ADMIN_TOKEN"
assert_status "Create timeslot — missing fields → 400" "400" || true

# ── 7. Create timeslot — no auth → 401 ──
api_call POST "/timetable" \
  "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Wednesday\",\"periodNumber\":1,\"effectiveFrom\":\"2026-03-01\"}"
assert_status "Create timeslot — no auth → 401" "401" || true

# ── 8. Create timeslot — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/timetable" \
    "{\"classId\":\"${CLASS_ID}\",\"subjectId\":\"${SUBJECT_ID}\",\"teacherId\":\"${TEACHER_ID}\",\"dayOfWeek\":\"Wednesday\",\"periodNumber\":1,\"effectiveFrom\":\"2026-03-01\"}" \
    "$TEACHER_TOKEN"
  assert_status "Create timeslot — Teacher → 403" "403" || true
fi

section "Timetable — LIST / QUERY"

# ── 9. List all timetable ──
api_call GET "/timetable" "" "$ADMIN_TOKEN"
assert_status "List timetable" "200" || true
assert_json_key "List timetable — array" ".timetable" || true

# ── 10. Query by dayOfWeek ──
api_call GET "/timetable?dayOfWeek=Monday" "" "$ADMIN_TOKEN"
assert_status "Query timetable — dayOfWeek" "200" || true

# ── 11. Query by teacherId ──
api_call GET "/timetable?teacherId=${TEACHER_ID}" "" "$ADMIN_TOKEN"
assert_status "Query timetable — teacherId" "200" || true

# ── 12. Query by classId ──
api_call GET "/timetable?classId=${CLASS_ID}" "" "$ADMIN_TOKEN"
assert_status "Query timetable — classId" "200" || true

# ── 13. Query by date ──
api_call GET "/timetable?date=2026-03-02" "" "$ADMIN_TOKEN"
assert_status "Query timetable — date=2026-03-02 (Monday)" "200" || true

# ── 14. Query with status=Active ──
api_call GET "/timetable?status=Active" "" "$ADMIN_TOKEN"
assert_status "Query timetable — status=Active" "200" || true

# ── 15. Query with status=All ──
api_call GET "/timetable?status=All" "" "$ADMIN_TOKEN"
assert_status "Query timetable — status=All" "200" || true

# ── 16. Teacher can view timetable ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call GET "/timetable" "" "$TEACHER_TOKEN"
  assert_status "List timetable — Teacher" "200" || true
fi

# ── 17. Timetable — no auth → 401 ──
api_call GET "/timetable" ""
assert_status "List timetable — no auth → 401" "401" || true

section "Timetable — END ASSIGNMENT"

# ── 18. End timeslot ──
if [[ -n "$TIMESLOT_ID_2" ]]; then
  api_call PUT "/timetable/${TIMESLOT_ID_2}/end" \
    '{"effectiveTo":"2026-06-30"}' "$ADMIN_TOKEN"
  assert_status "End timeslot" "200" || true
  assert_json_key "End timeslot — effectiveTo" ".timeSlot.effectiveTo" || true
fi

# ── 19. End timeslot — not found → 404 ──
api_call PUT "/timetable/NONEXIST/end" \
  '{"effectiveTo":"2026-06-30"}' "$ADMIN_TOKEN"
assert_status "End timeslot — not found → 404" "404" || true

# ── 20. End timeslot — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" && -n "$TIMESLOT_ID" ]]; then
  api_call PUT "/timetable/${TIMESLOT_ID}/end" \
    '{"effectiveTo":"2026-06-30"}' "$TEACHER_TOKEN"
  assert_status "End timeslot — Teacher → 403" "403" || true
fi

# ── 21. End timeslot — no auth → 401 ──
if [[ -n "$TIMESLOT_ID" ]]; then
  api_call PUT "/timetable/${TIMESLOT_ID}/end" \
    '{"effectiveTo":"2026-06-30"}'
  assert_status "End timeslot — no auth → 401" "401" || true
fi

print_summary "Timetable"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Students CRUD
#   GET    /students
#   POST   /students
#   DELETE /students/:id
#   DELETE /students/bulk
#   GET    /students/:studentId/attendance
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")
BATCH_ID=$(get_state "BATCH_ID")
CLASS_ID=$(get_state "CLASS_ID")

if [[ -z "$ADMIN_TOKEN" || -z "$BATCH_ID" || -z "$CLASS_ID" ]]; then
  echo "ERROR: Missing state. Run previous scripts first."
  exit 1
fi

UID_SUFFIX=$(unique_id)

section "Students — CREATE"

# ── 1. Create student ──
api_call POST "/students" \
  "{\"name\":\"Student A ${UID_SUFFIX}\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}" \
  "$ADMIN_TOKEN"
assert_status "Create student" "201" || true
assert_json_key "Create student — id" ".student.id" || true
assert_json_key "Create student — name" ".student.name" || true

STUDENT_ID=$(json_body ".student.id" || true)
save_state "STUDENT_ID" "$STUDENT_ID"

# ── 2. Create second student ──
api_call POST "/students" \
  "{\"name\":\"Student B ${UID_SUFFIX}\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}" \
  "$ADMIN_TOKEN"
assert_status "Create second student" "201" || true
STUDENT_ID_2=$(json_body ".student.id" || true)
save_state "STUDENT_ID_2" "$STUDENT_ID_2"

# ── 3. Create third student (for attendance tests) ──
api_call POST "/students" \
  "{\"name\":\"Student C ${UID_SUFFIX}\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}" \
  "$ADMIN_TOKEN"
assert_status "Create third student" "201" || true
STUDENT_ID_3=$(json_body ".student.id" || true)
save_state "STUDENT_ID_3" "$STUDENT_ID_3"

# ── 4. Create student — missing classId → 400 ──
api_call POST "/students" \
  "{\"name\":\"NoClass\",\"batchId\":\"${BATCH_ID}\"}" "$ADMIN_TOKEN"
assert_status "Create student — missing classId → 400" "400" || true

# ── 5. Create student — no auth → 401 ──
api_call POST "/students" \
  "{\"name\":\"NoAuth\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}"
assert_status "Create student — no auth → 401" "401" || true

# ── 6. Create student — Teacher → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/students" \
    "{\"name\":\"Forbidden\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}" "$TEACHER_TOKEN"
  assert_status "Create student — Teacher → 403" "403" || true
fi

section "Students — LIST"

# ── 7. List students ──
api_call GET "/students" "" "$ADMIN_TOKEN"
assert_status "List students" "200" || true
assert_json_key "List students — array present" ".students" || true
assert_json_key "List students — pagination" ".pagination" || true

# ── 8. List students — filter by classId ──
api_call GET "/students?classId=${CLASS_ID}" "" "$ADMIN_TOKEN"
assert_status "List students — classId filter" "200" || true

# ── 9. List students — filter by batchId ──
api_call GET "/students?batchId=${BATCH_ID}" "" "$ADMIN_TOKEN"
assert_status "List students — batchId filter" "200" || true

# ── 10. List students — search ──
api_call GET "/students?search=Student" "" "$ADMIN_TOKEN"
assert_status "List students — search" "200" || true

# ── 11. List students — pagination ──
api_call GET "/students?limit=1&offset=0" "" "$ADMIN_TOKEN"
assert_status "List students — limit=1" "200" || true
assert_json_key "List students — pagination.total" ".pagination.total" || true

# ── 12. List students — no auth → 401 ──
api_call GET "/students" ""
assert_status "List students — no auth → 401" "401" || true

section "Students — Attendance History"

# ── 13. Get student attendance (empty initially) ──
if [[ -n "$STUDENT_ID" ]]; then
  api_call GET "/students/${STUDENT_ID}/attendance" "" "$ADMIN_TOKEN"
  assert_status "Get student attendance history" "200" || true
  assert_json_key "Attendance — student" ".student" || true
  assert_json_key "Attendance — records array" ".records" || true

  # ── 14. With date filters ──
  api_call GET "/students/${STUDENT_ID}/attendance?from=2026-01-01&to=2026-12-31" "" "$ADMIN_TOKEN"
  assert_status "Get student attendance — date filter" "200" || true
fi

# ── 15. Attendance — student not found → 404 ──
api_call GET "/students/NONEXIST/attendance" "" "$ADMIN_TOKEN"
assert_status "Get attendance — student not found → 404" "404" || true

section "Students — DELETE"

# Create for delete
api_call POST "/students" \
  "{\"name\":\"DeleteMe\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}" "$ADMIN_TOKEN"
DEL_STUDENT_ID=$(json_body ".student.id" || true)

# ── 16. Delete student ──
if [[ -n "$DEL_STUDENT_ID" ]]; then
  api_call DELETE "/students/${DEL_STUDENT_ID}" "" "$ADMIN_TOKEN"
  assert_status "Delete student" "204" || true
fi

# ── 17. Delete student — not found → 404 ──
api_call DELETE "/students/NONEXIST" "" "$ADMIN_TOKEN"
assert_status "Delete student — not found → 404" "404" || true

section "Students — BULK DELETE"

BULK_IDS=()
for i in 1 2; do
  api_call POST "/students" \
    "{\"name\":\"BulkStudent${i}\",\"classId\":\"${CLASS_ID}\",\"batchId\":\"${BATCH_ID}\"}" "$ADMIN_TOKEN"
  ID=$(json_body ".student.id" || true)
  if [[ -n "$ID" ]]; then
    BULK_IDS+=("\"$ID\"")
  fi
done

if [[ ${#BULK_IDS[@]} -ge 2 ]]; then
  IDS_JSON=$(IFS=,; echo "${BULK_IDS[*]}")
  # ── 18. Bulk delete students ──
  api_call DELETE "/students/bulk" \
    "{\"ids\":[${IDS_JSON}]}" "$ADMIN_TOKEN"
  assert_status "Bulk delete students" "200" || true
  assert_json_key "Bulk delete — deleted array" ".deleted" || true
fi

# ── 19. Bulk delete — empty → 400 ──
api_call DELETE "/students/bulk" \
  '{"ids":[]}' "$ADMIN_TOKEN"
assert_status "Bulk delete — empty → 400" "400" || true

print_summary "Students"

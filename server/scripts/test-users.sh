#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Users CRUD
#   GET    /users
#   POST   /users
#   PUT    /users/:id/roles
#   DELETE /users/:id
#   DELETE /users/bulk
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERROR: ADMIN_TOKEN not found. Run bootstrap first."
  exit 1
fi

section "Users — CREATE"

UID_SUFFIX=$(unique_id)

# ── 1. Create user (Teacher) ──
api_call POST "/users" \
  "{\"name\":\"New Teacher ${UID_SUFFIX}\",\"email\":\"newteacher${UID_SUFFIX}@test.com\",\"password\":\"Password@123\",\"roles\":[\"Teacher\"]}" \
  "$ADMIN_TOKEN"
assert_status "Create Teacher user" "201" || true
assert_json_key "Create Teacher — user.id" ".user.id" || true

CREATED_USER_ID=$(json_body ".user.id" || true)
save_state "CREATED_USER_ID" "$CREATED_USER_ID"

# ── 2. Create user (Admin) ──
api_call POST "/users" \
  "{\"name\":\"New Admin ${UID_SUFFIX}\",\"email\":\"newadmin${UID_SUFFIX}@test.com\",\"password\":\"Password@123\",\"roles\":[\"Admin\"]}" \
  "$ADMIN_TOKEN"
assert_status "Create Admin user" "201" || true

CREATED_ADMIN_ID=$(json_body ".user.id" || true)

# ── 3. Create user (multi-role) ──
api_call POST "/users" \
  "{\"name\":\"Dual Role ${UID_SUFFIX}\",\"email\":\"dual${UID_SUFFIX}@test.com\",\"password\":\"Password@123\",\"roles\":[\"Teacher\",\"Admin\"]}" \
  "$ADMIN_TOKEN"
assert_status "Create multi-role user" "201" || true

# ── 4. Create user — duplicate email → 409 ──
api_call POST "/users" \
  "{\"name\":\"Dup\",\"email\":\"newteacher${UID_SUFFIX}@test.com\",\"password\":\"Password@123\",\"roles\":[\"Teacher\"]}" \
  "$ADMIN_TOKEN"
assert_status "Create user — duplicate email → 409" "409" || true

# ── 5. Create user — missing required fields → 400 ──
api_call POST "/users" \
  '{"name":"No Email"}' "$ADMIN_TOKEN"
assert_status "Create user — missing fields → 400" "400" || true

# ── 6. Create user — short password → 400 ──
api_call POST "/users" \
  "{\"name\":\"ShortPw\",\"email\":\"short${UID_SUFFIX}@test.com\",\"password\":\"short\",\"roles\":[\"Teacher\"]}" \
  "$ADMIN_TOKEN"
assert_status "Create user — short password → 400" "400" || true

# ── 7. Create user — no auth → 401 ──
api_call POST "/users" \
  '{"name":"NoAuth","email":"noauth@test.com","password":"Password@123","roles":["Teacher"]}'
assert_status "Create user — no auth → 401" "401" || true

# ── 8. Create user — Teacher role (non-Admin) → 403 ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call POST "/users" \
    '{"name":"Forbidden","email":"forbidden@test.com","password":"Password@123","roles":["Teacher"]}' \
    "$TEACHER_TOKEN"
  assert_status "Create user — Teacher → 403" "403" || true
fi

section "Users — LIST"

# ── 9. List all users ──
api_call GET "/users" "" "$ADMIN_TOKEN"
assert_status "List users" "200" || true
assert_json_key "List users — array present" ".users" || true

# ── 10. List users — filter by role ──
api_call GET "/users?role=Teacher" "" "$ADMIN_TOKEN"
assert_status "List users — role=Teacher" "200" || true

# ── 11. List users — search ──
api_call GET "/users?search=New" "" "$ADMIN_TOKEN"
assert_status "List users — search=New" "200" || true

# ── 12. List users — no auth → 401 ──
api_call GET "/users" ""
assert_status "List users — no auth → 401" "401" || true

section "Users — UPDATE ROLES"

# ── 13. Update user roles ──
if [[ -n "$CREATED_USER_ID" ]]; then
  api_call PUT "/users/${CREATED_USER_ID}/roles" \
    '{"roles":["Teacher","Admin"]}' "$ADMIN_TOKEN"
  assert_status "Update user roles" "200" || true
  assert_json_key "Update roles — roles array" ".user.roles" || true
fi

# ── 14. Update own roles → 403 ──
ADMIN_ID=$(get_state "ADMIN_ID")
if [[ -n "$ADMIN_ID" ]]; then
  api_call PUT "/users/${ADMIN_ID}/roles" \
    '{"roles":["Teacher","Admin"]}' "$ADMIN_TOKEN"
  assert_status "Update own roles → 403" "403" || true
fi

# ── 15. Update roles — user not found → 404 ──
api_call PUT "/users/NONEXIST/roles" \
  '{"roles":["Teacher"]}' "$ADMIN_TOKEN"
assert_status "Update roles — not found → 404" "404" || true

# ── 16. Update roles — empty array → 400 ──
if [[ -n "$CREATED_USER_ID" ]]; then
  api_call PUT "/users/${CREATED_USER_ID}/roles" \
    '{"roles":[]}' "$ADMIN_TOKEN"
  assert_status "Update roles — empty array → 400" "400" || true
fi

section "Users — DELETE"

# ── 17. Delete user ──
if [[ -n "$CREATED_USER_ID" ]]; then
  api_call DELETE "/users/${CREATED_USER_ID}" "" "$ADMIN_TOKEN"
  assert_status "Delete user" "204" || true
fi

# ── 18. Delete user — not found → 404 ──
api_call DELETE "/users/NONEXIST" "" "$ADMIN_TOKEN"
assert_status "Delete user — not found → 404" "404" || true

section "Users — BULK DELETE"

# Create two users for bulk delete
BULK_IDS=()
for i in 1 2; do
  api_call POST "/users" \
    "{\"name\":\"Bulk${i} ${UID_SUFFIX}\",\"email\":\"bulk${i}-${UID_SUFFIX}@test.com\",\"password\":\"Password@123\",\"roles\":[\"Teacher\"]}" \
    "$ADMIN_TOKEN"
  ID=$(json_body ".user.id" || true)
  if [[ -n "$ID" ]]; then
    BULK_IDS+=("\"$ID\"")
  fi
done

if [[ ${#BULK_IDS[@]} -ge 2 ]]; then
  IDS_JSON=$(IFS=,; echo "${BULK_IDS[*]}")
  # ── 19. Bulk delete ──
  api_call DELETE "/users/bulk" \
    "{\"ids\":[${IDS_JSON}]}" "$ADMIN_TOKEN"
  assert_status "Bulk delete users" "200" || true
  assert_json_key "Bulk delete — deleted array" ".deleted" || true
fi

# ── 20. Bulk delete — empty array → 400 ──
api_call DELETE "/users/bulk" \
  '{"ids":[]}' "$ADMIN_TOKEN"
assert_status "Bulk delete — empty array → 400" "400" || true

# ── 21. Bulk delete — non-existent IDs ──
api_call DELETE "/users/bulk" \
  '{"ids":["NONEXIST1","NONEXIST2"]}' "$ADMIN_TOKEN"
assert_status "Bulk delete — non-existent IDs → 200 (partial)" "200" || true

print_summary "Users"

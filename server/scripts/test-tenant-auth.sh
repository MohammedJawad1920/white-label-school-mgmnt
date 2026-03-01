#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Tenant Auth (POST /auth/login, /logout, /switch-role)
# Requires bootstrap-test-data.sh to have run first
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

TENANT_SLUG=$(get_state "TENANT_SLUG")
ADMIN_EMAIL=$(get_state "ADMIN_EMAIL")
ADMIN_PASSWORD=$(get_state "ADMIN_PASSWORD")
ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_EMAIL=$(get_state "TEACHER_EMAIL")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")
MULTI_EMAIL=$(get_state "MULTI_EMAIL")
MULTI_PASSWORD=$(get_state "MULTI_PASSWORD")
MULTI_TOKEN=$(get_state "MULTI_TOKEN")

section "Tenant Auth — Login (happy path)"

# ── 1. Admin login ──
api_call POST "/auth/login" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"tenantSlug\":\"${TENANT_SLUG}\"}"
assert_status "Admin login — 200" "200" || true
assert_json_key "Admin login — token" ".token" || true
assert_json_key "Admin login — user.id" ".user.id" || true
assert_json_key "Admin login — user.roles" ".user.roles" || true
assert_json_key "Admin login — user.activeRole" ".user.activeRole" || true

# ── 2. Teacher login ──
api_call POST "/auth/login" \
  "{\"email\":\"${TEACHER_EMAIL}\",\"password\":\"TestTeach@123\",\"tenantSlug\":\"${TENANT_SLUG}\"}"
assert_status "Teacher login — 200" "200" || true
assert_json_key "Teacher login — token" ".token" || true

section "Tenant Auth — Login (error cases)"

# ── 3. Missing tenantSlug → 400 ──
api_call POST "/auth/login" \
  '{"email":"admin@test.com","password":"password123"}'
assert_status "Login — missing tenantSlug → 400" "400" || true

# ── 4. Unknown tenant → 404 ──
api_call POST "/auth/login" \
  '{"email":"admin@test.com","password":"password123","tenantSlug":"nonexistent999"}'
assert_status "Login — unknown tenant → 404" "404" || true

# ── 5. Wrong password → 401 ──
api_call POST "/auth/login" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"wrongpass1\",\"tenantSlug\":\"${TENANT_SLUG}\"}"
assert_status "Login — wrong password → 401" "401" || true

# ── 6. Missing password → 400 ──
api_call POST "/auth/login" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"tenantSlug\":\"${TENANT_SLUG}\"}"
assert_status "Login — missing password → 400" "400" || true

# ── 7. Non-existent user → 401 ──
api_call POST "/auth/login" \
  "{\"email\":\"ghost@nobody.com\",\"password\":\"password123\",\"tenantSlug\":\"${TENANT_SLUG}\"}"
assert_status "Login — non-existent user → 401" "401" || true

section "Tenant Auth — Switch Role"

# ── 8. Multi-role user switches to Teacher ──
api_call POST "/auth/switch-role" \
  '{"role":"Teacher"}' "$MULTI_TOKEN"
assert_status "Switch role to Teacher — 200" "200" || true
assert_json_key "Switch role — new token" ".token" || true
assert_json_key "Switch role — user.activeRole" ".user.activeRole" || true

# Save updated multi token
NEW_MULTI_TOKEN=$(json_body ".token" || true)
if [[ -n "$NEW_MULTI_TOKEN" ]]; then
  save_state "MULTI_TOKEN" "$NEW_MULTI_TOKEN"
fi

# ── 9. Switch back to Admin ──
api_call POST "/auth/switch-role" \
  '{"role":"Admin"}' "$NEW_MULTI_TOKEN"
assert_status "Switch role back to Admin — 200" "200" || true
NEW_MULTI_TOKEN=$(json_body ".token" || true)
if [[ -n "$NEW_MULTI_TOKEN" ]]; then
  save_state "MULTI_TOKEN" "$NEW_MULTI_TOKEN"
fi

# ── 10. Single-role user tries to switch → 403 ──
api_call POST "/auth/switch-role" \
  '{"role":"Teacher"}' "$ADMIN_TOKEN"
assert_status "Single-role switch → 403" "403" || true

# ── 11. Switch to unassigned role → 400 ──
api_call POST "/auth/switch-role" \
  '{"role":"Admin"}' "$TEACHER_TOKEN"
assert_status "Switch to unassigned role → 400" "400" || true

# ── 12. Switch role — no auth → 401 ──
api_call POST "/auth/switch-role" \
  '{"role":"Teacher"}'
assert_status "Switch role — no auth → 401" "401" || true

section "Tenant Auth — Logout"

# ── 13. Logout ──
api_call POST "/auth/logout" "" "$ADMIN_TOKEN"
assert_status "Logout — 204" "204" || true

# ── 14. Logout — no token → 401 ──
api_call POST "/auth/logout" ""
assert_status "Logout — no token → 401" "401" || true

# Re-login admin for subsequent tests
api_call POST "/auth/login" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"tenantSlug\":\"${TENANT_SLUG}\"}"
if [[ "$HTTP_STATUS" == "200" ]]; then
  ADMIN_TOKEN=$(json_body ".token")
  save_state "ADMIN_TOKEN" "$ADMIN_TOKEN"
  echo -e "  ${YELLOW}→ Admin re-logged in, token saved${NC}"
fi

print_summary "Tenant Auth"

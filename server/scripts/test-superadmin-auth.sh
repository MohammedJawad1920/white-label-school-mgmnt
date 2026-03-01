#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: SuperAdmin Auth  (POST /super-admin/auth/login)
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

section "SuperAdmin Auth"

# ── 1. Login with valid credentials ──
api_call POST "/super-admin/auth/login" \
  "{\"email\":\"${SA_EMAIL}\",\"password\":\"${SA_PASSWORD}\"}"
assert_status "SA Login — valid credentials" "200" || true
assert_json_key "SA Login — token present" ".token" || true
assert_json_key "SA Login — superAdmin.id present" ".superAdmin.id" || true
assert_json_key "SA Login — superAdmin.email present" ".superAdmin.email" || true

# Save token for later scripts
SA_TOKEN=$(json_body ".token" || true)
if [[ -n "$SA_TOKEN" ]]; then
  save_state "SA_TOKEN" "$SA_TOKEN"
  echo -e "  ${YELLOW}→ SA token saved to state${NC}"
fi

# ── 2. Login with wrong password ──
api_call POST "/super-admin/auth/login" \
  "{\"email\":\"${SA_EMAIL}\",\"password\":\"wrongpassword1\"}"
assert_status "SA Login — wrong password → 401" "401" || true

# ── 3. Login with missing fields ──
api_call POST "/super-admin/auth/login" \
  "{\"email\":\"${SA_EMAIL}\"}"
assert_status "SA Login — missing password → 400" "400" || true

# ── 4. Login with non-existent email ──
api_call POST "/super-admin/auth/login" \
  "{\"email\":\"nobody@example.com\",\"password\":\"password123\"}"
assert_status "SA Login — unknown email → 401" "401" || true

print_summary "SuperAdmin Auth"

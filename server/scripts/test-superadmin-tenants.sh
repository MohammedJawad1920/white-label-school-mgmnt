#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: SuperAdmin Tenant CRUD
#   GET  /super-admin/tenants
#   POST /super-admin/tenants
#   PUT  /super-admin/tenants/:id
#   PUT  /super-admin/tenants/:id/deactivate
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

SA_TOKEN=$(get_state "SA_TOKEN")
if [[ -z "$SA_TOKEN" ]]; then
  echo "ERROR: SA_TOKEN not found. Run test-superadmin-auth.sh first."
  exit 1
fi

SLUG="testschool$(unique_id)"
TENANT_ID="T-$(unique_id)"

section "SuperAdmin Tenants — CREATE"

# ── 1. Create tenant ──
api_call POST "/super-admin/tenants" \
  "{\"id\":\"${TENANT_ID}\",\"name\":\"Test School\",\"slug\":\"${SLUG}\"}" \
  "$SA_TOKEN"
assert_status "Create tenant" "201" || true
assert_json_key "Create tenant — id" ".tenant.id" || true
assert_json_key "Create tenant — slug" ".tenant.slug" || true
assert_json_key "Create tenant — status = active" ".tenant.status" || true

save_state "TENANT_ID" "$TENANT_ID"
save_state "TENANT_SLUG" "$SLUG"

# ── 2. Create tenant — duplicate slug → 409 ──
api_call POST "/super-admin/tenants" \
  "{\"id\":\"T-dup$(unique_id)\",\"name\":\"Dup School\",\"slug\":\"${SLUG}\"}" \
  "$SA_TOKEN"
assert_status "Create tenant — duplicate slug → 409" "409" || true

# ── 3. Create tenant — missing fields → 400 ──
api_call POST "/super-admin/tenants" \
  "{\"name\":\"No ID School\"}" \
  "$SA_TOKEN"
assert_status "Create tenant — missing fields → 400" "400" || true

# ── 4. Create tenant — no auth → 401 ──
api_call POST "/super-admin/tenants" \
  "{\"id\":\"T-noauth\",\"name\":\"No Auth\",\"slug\":\"noauth\"}"
assert_status "Create tenant — no auth → 401" "401" || true

section "SuperAdmin Tenants — LIST"

# ── 5. List tenants ──
api_call GET "/super-admin/tenants" "" "$SA_TOKEN"
assert_status "List tenants" "200" || true
assert_json_key "List tenants — array present" ".tenants" || true

# ── 6. List tenants — with status filter ──
api_call GET "/super-admin/tenants?status=active" "" "$SA_TOKEN"
assert_status "List tenants — status=active" "200" || true

# ── 7. List tenants — with search filter ──
api_call GET "/super-admin/tenants?search=Test" "" "$SA_TOKEN"
assert_status "List tenants — search=Test" "200" || true

section "SuperAdmin Tenants — UPDATE"

# ── 8. Update tenant name ──
api_call PUT "/super-admin/tenants/${TENANT_ID}" \
  "{\"name\":\"Updated Test School\"}" \
  "$SA_TOKEN"
assert_status "Update tenant name" "200" || true
assert_json_key "Update tenant — name updated" ".tenant.name" || true

# ── 9. Update tenant — not found → 404 ──
api_call PUT "/super-admin/tenants/NONEXIST" \
  "{\"name\":\"Ghost\"}" \
  "$SA_TOKEN"
assert_status "Update tenant — not found → 404" "404" || true

section "SuperAdmin Tenants — DEACTIVATE"

# Create a second tenant specifically for deactivation
DEACT_ID="T-deact$(unique_id)"
DEACT_SLUG="deact$(unique_id)"
api_call POST "/super-admin/tenants" \
  "{\"id\":\"${DEACT_ID}\",\"name\":\"Deact School\",\"slug\":\"${DEACT_SLUG}\"}" \
  "$SA_TOKEN"

# ── 10. Deactivate tenant ──
api_call PUT "/super-admin/tenants/${DEACT_ID}/deactivate" "" "$SA_TOKEN"
assert_status "Deactivate tenant" "200" || true
assert_json_key "Deactivate tenant — status" ".tenant.status" || true

# ── 11. Deactivate already-inactive → 409 ──
api_call PUT "/super-admin/tenants/${DEACT_ID}/deactivate" "" "$SA_TOKEN"
assert_status "Deactivate already-inactive → 409" "409" || true

# ── 12. Deactivate non-existent → 404 ──
api_call PUT "/super-admin/tenants/NONEXIST/deactivate" "" "$SA_TOKEN"
assert_status "Deactivate non-existent → 404" "404" || true

print_summary "SuperAdmin Tenants"

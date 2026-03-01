#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: SuperAdmin Feature Flags
#   GET /super-admin/tenants/:tenantId/features
#   PUT /super-admin/tenants/:tenantId/features/:featureKey
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

SA_TOKEN=$(get_state "SA_TOKEN")
TENANT_ID=$(get_state "TENANT_ID")

if [[ -z "$SA_TOKEN" || -z "$TENANT_ID" ]]; then
  echo "ERROR: SA_TOKEN or TENANT_ID not found. Run earlier scripts first."
  exit 1
fi

section "SuperAdmin Features — READ"

# ── 1. Get features for tenant ──
api_call GET "/super-admin/tenants/${TENANT_ID}/features" "" "$SA_TOKEN"
assert_status "Get tenant features" "200" || true
assert_json_key "Get tenant features — array present" ".features" || true

# ── 2. Get features — non-existent tenant → 404 ──
api_call GET "/super-admin/tenants/NONEXIST/features" "" "$SA_TOKEN"
assert_status "Get features — unknown tenant → 404" "404" || true

section "SuperAdmin Features — TOGGLE"

# ── 3. Enable timetable ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/timetable" \
  '{"enabled":true}' "$SA_TOKEN"
assert_status "Enable timetable" "200" || true
assert_json_key "Enable timetable — feature.enabled" ".feature.enabled" || true

# ── 4. Enable attendance (requires timetable) ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/attendance" \
  '{"enabled":true}' "$SA_TOKEN"
assert_status "Enable attendance" "200" || true

# ── 5. Disable timetable while attendance enabled → 400 (dependency) ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/timetable" \
  '{"enabled":false}' "$SA_TOKEN"
assert_status "Disable timetable (attendance depends on it) → 400" "400" || true

# ── 6. Disable attendance first ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/attendance" \
  '{"enabled":false}' "$SA_TOKEN"
assert_status "Disable attendance" "200" || true

# ── 7. Now disable timetable ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/timetable" \
  '{"enabled":false}' "$SA_TOKEN"
assert_status "Disable timetable (after attendance disabled)" "200" || true

# ── 8. Re-enable timetable for subsequent tests ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/timetable" \
  '{"enabled":true}' "$SA_TOKEN"
assert_status "Re-enable timetable for later tests" "200" || true

# ── 9. Re-enable attendance for subsequent tests ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/attendance" \
  '{"enabled":true}' "$SA_TOKEN"
assert_status "Re-enable attendance for later tests" "200" || true

# ── 10. Enable attendance without timetable → 400 ──
# First create a fresh tenant with no features enabled
FRESH_ID="T-fresh$(unique_id)"
FRESH_SLUG="fresh$(unique_id)"
api_call POST "/super-admin/tenants" \
  "{\"id\":\"${FRESH_ID}\",\"name\":\"Fresh School\",\"slug\":\"${FRESH_SLUG}\"}" \
  "$SA_TOKEN"

api_call PUT "/super-admin/tenants/${FRESH_ID}/features/attendance" \
  '{"enabled":true}' "$SA_TOKEN"
assert_status "Enable attendance w/o timetable → 400" "400" || true

# ── 11. Toggle unknown feature → 404 ──
api_call PUT "/super-admin/tenants/${TENANT_ID}/features/unknown_feature" \
  '{"enabled":true}' "$SA_TOKEN"
assert_status "Toggle unknown feature → 404" "404" || true

print_summary "SuperAdmin Features"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# Test: Features (Tenant-scoped, read-only)
#   GET /features
#   PUT /features/:featureKey  (should always return 403)
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

ADMIN_TOKEN=$(get_state "ADMIN_TOKEN")
TEACHER_TOKEN=$(get_state "TEACHER_TOKEN")

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ERROR: ADMIN_TOKEN not found. Run bootstrap first."
  exit 1
fi

section "Features — LIST (tenant-scoped)"

# ── 1. List features as Admin ──
api_call GET "/features" "" "$ADMIN_TOKEN"
assert_status "List features — Admin" "200" || true
assert_json_key "List features — array present" ".features" || true

# ── 2. List features as Teacher ──
if [[ -n "$TEACHER_TOKEN" ]]; then
  api_call GET "/features" "" "$TEACHER_TOKEN"
  assert_status "List features — Teacher" "200" || true
fi

# ── 3. List features — no auth → 401 ──
api_call GET "/features" ""
assert_status "List features — no auth → 401" "401" || true

section "Features — TOGGLE (removed in v3.2, always 403)"

# ── 4. Toggle timetable → 403 ──
api_call PUT "/features/timetable" \
  '{"enabled":false}' "$ADMIN_TOKEN"
assert_status "Toggle feature via tenant API → 403" "403" || true

# ── 5. Toggle attendance → 403 ──
api_call PUT "/features/attendance" \
  '{"enabled":true}' "$ADMIN_TOKEN"
assert_status "Toggle attendance via tenant API → 403" "403" || true

print_summary "Features (tenant-scoped)"

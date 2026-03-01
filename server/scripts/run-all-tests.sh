#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# run-all-tests.sh — Master runner for all API endpoint tests
# ─────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  White-Label School Management — API Test Suite     ║${NC}"
echo -e "${BOLD}║  OpenAPI v3.3.0 — All CRUD Endpoints                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites check ──
echo -e "${CYAN}Checking prerequisites...${NC}"

if ! command -v curl &>/dev/null; then
  echo -e "${RED}ERROR: curl is not installed${NC}"
  exit 1
fi

# jq replaced by node-based json_get — no jq needed

if ! command -v node &>/dev/null; then
  echo -e "${RED}ERROR: node is not installed${NC}"
  exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:3000/api}"
echo -e "  Base URL: ${BASE_URL}"

# Check server is running
HTTP_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL%/api}/health" 2>/dev/null || echo "000")
if [[ "$HTTP_CHECK" == "000" ]]; then
  echo -e "${RED}ERROR: Server not reachable at ${BASE_URL%/api}/health${NC}"
  echo -e "${YELLOW}Make sure the server is running: cd server && npm run dev${NC}"
  exit 1
fi
echo -e "  ${GREEN}Server is reachable (HTTP ${HTTP_CHECK})${NC}"

# ── Reset state file ──
export STATE_FILE="/tmp/wl-test-state-$(date +%s).json"
echo '{}' > "$STATE_FILE"
echo -e "  State file: ${STATE_FILE}"
echo ""

# ── Test execution order ──
# The order matters: later scripts depend on data created by earlier ones.
SCRIPTS=(
  "test-superadmin-auth.sh"       # 1. Get SA token
  "test-superadmin-tenants.sh"    # 2. Create test tenant
  "test-superadmin-features.sh"   # 3. Enable timetable + attendance
  "bootstrap-test-data.sh"        # 4. Create admin/teacher users via DB
  "test-tenant-auth.sh"           # 5. Test tenant auth flows
  "test-users.sh"                 # 6. User CRUD
  "test-batches.sh"               # 7. Batch CRUD
  "test-subjects.sh"              # 8. Subject CRUD
  "test-classes.sh"               # 9. Class CRUD
  "test-students.sh"              # 10. Student CRUD
  "test-features.sh"              # 11. Tenant features (read-only)
  "test-school-periods.sh"        # 12. School periods CRUD
  "test-timetable.sh"             # 13. Timetable CRUD
  "test-attendance.sh"            # 14. Attendance recording & summary
)

TOTAL_SCRIPTS=${#SCRIPTS[@]}
PASSED_SCRIPTS=0
FAILED_SCRIPTS=0
FAILED_NAMES=()

for i in "${!SCRIPTS[@]}"; do
  script="${SCRIPTS[$i]}"
  num=$((i + 1))
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  [${num}/${TOTAL_SCRIPTS}] Running: ${script}${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"

  if bash "$SCRIPT_DIR/$script"; then
    PASSED_SCRIPTS=$((PASSED_SCRIPTS + 1))
  else
    FAILED_SCRIPTS=$((FAILED_SCRIPTS + 1))
    FAILED_NAMES+=("$script")
    echo -e "${YELLOW}  ⚠ Script exited with errors, continuing...${NC}"
  fi
done

# ── Final Summary ──
echo ""
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              FINAL TEST SUITE SUMMARY                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Total scripts : ${TOTAL_SCRIPTS}"
echo -e "  ${GREEN}Passed        : ${PASSED_SCRIPTS}${NC}"
if [[ $FAILED_SCRIPTS -gt 0 ]]; then
  echo -e "  ${RED}Failed        : ${FAILED_SCRIPTS}${NC}"
  echo ""
  echo -e "  ${RED}Failed scripts:${NC}"
  for name in "${FAILED_NAMES[@]}"; do
    echo -e "    ${RED}• ${name}${NC}"
  done
else
  echo -e "  Failed        : 0"
fi
echo ""
echo -e "  State file: ${STATE_FILE}"
echo ""

# Cleanup
if [[ $FAILED_SCRIPTS -gt 0 ]]; then
  exit 1
fi

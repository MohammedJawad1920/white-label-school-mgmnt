#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# helpers.sh — shared utilities for all test scripts
# ─────────────────────────────────────────────────────
set -euo pipefail

export BASE_URL="${BASE_URL:-http://localhost:3000/api}"
export SA_EMAIL="${SA_EMAIL:-admin@platform.com}"
export SA_PASSWORD="${SA_PASSWORD:-SuperAdmin@123}"

# ── Counters ──
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# ── Temp file for sharing state between scripts ──
export STATE_FILE="${STATE_FILE:-/tmp/wl-test-state.json}"

# Initialise state file if it doesn't exist
if [[ ! -f "$STATE_FILE" ]]; then
  echo '{}' > "$STATE_FILE"
fi

# ── Colours ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── JSON helper (uses node instead of jq) ──
# Supports paths like: .token, .user.id, .periods[0].id, .periods.length
json_get() {
  local json_str="$1"
  local key_path="$2"
  node -e "
    try {
      const d = JSON.parse(process.argv[1]);
      const path = process.argv[2];
      // Handle .foo | length  or  .foo.length
      const evalPath = path
        .replace(/^\\./, '')
        .replace(/\\s*\\|\\s*length/, '.length');
      const parts = evalPath.match(/[^.\\[\\]]+|\\[\\d+\\]/g) || [];
      let v = d;
      for (const p of parts) {
        if (p === 'length' && Array.isArray(v)) { v = v.length; break; }
        const idx = p.match(/^\\[(\\d+)\\]$/);
        if (idx) v = v[parseInt(idx[1])];
        else v = v[p];
        if (v === undefined || v === null) { process.exit(1); }
      }
      if (typeof v === 'object') process.stdout.write(JSON.stringify(v));
      else process.stdout.write(String(v));
    } catch(e) { process.exit(1); }
  " "$json_str" "$key_path" 2>/dev/null
}

# Convenience: extract from HTTP_BODY
json_body() {
  json_get "$HTTP_BODY" "$1"
}

# ── State helpers ──
save_state() {
  local key="$1" value="$2"
  local current
  current=$(cat "$STATE_FILE")
  node -e "
    const d = JSON.parse(process.argv[1]);
    d[process.argv[2]] = process.argv[3];
    process.stdout.write(JSON.stringify(d));
  " "$current" "$key" "$value" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
}

get_state() {
  local key="$1"
  local current
  current=$(cat "$STATE_FILE")
  node -e "
    const d = JSON.parse(process.argv[1]);
    const v = d[process.argv[2]];
    if (v !== undefined && v !== null) process.stdout.write(String(v));
  " "$current" "$key" 2>/dev/null
}

# ── HTTP helpers ──
# Makes a request and stores status + body
# Usage: api_call METHOD /path [body]
# Sets: HTTP_STATUS, HTTP_BODY
HTTP_STATUS=""
HTTP_BODY=""

api_call() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local token="${4:-}"
  local url="${BASE_URL}${path}"

  local curl_args=( -s -w "\n%{http_code}" -X "$method" "$url"
    -H "Content-Type: application/json"
  )

  if [[ -n "$token" ]]; then
    curl_args+=( -H "Authorization: Bearer $token" )
  fi

  if [[ -n "$body" ]]; then
    curl_args+=( -d "$body" )
  fi

  local response
  response=$(curl "${curl_args[@]}" 2>/dev/null || true)

  HTTP_STATUS=$(echo "$response" | tail -n1)
  HTTP_BODY=$(echo "$response" | sed '$d')
}

# ── Assertion helpers ──
assert_status() {
  local test_name="$1"
  local expected="$2"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  if [[ "$HTTP_STATUS" == "$expected" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} $test_name (HTTP $HTTP_STATUS)"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo -e "  ${RED}[FAIL]${NC} $test_name — expected HTTP $expected, got $HTTP_STATUS"
    echo -e "  ${RED}  Body: ${HTTP_BODY:0:300}${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# Check JSON body contains a key (uses node)
assert_json_key() {
  local test_name="$1"
  local key="$2"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))

  local val
  val=$(json_get "$HTTP_BODY" "$key" 2>/dev/null) || val=""

  if [[ -n "$val" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} $test_name ($key = ${val:0:80})"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo -e "  ${RED}[FAIL]${NC} $test_name — key '$key' not found or null"
    echo -e "  ${RED}  Body: ${HTTP_BODY:0:300}${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# ── Section header ──
section() {
  echo ""
  echo -e "${CYAN}━━━ $1 ━━━${NC}"
}

# ── Summary ──
print_summary() {
  local label="${1:-Module}"
  echo ""
  echo -e "${CYAN}───────────────────────────────${NC}"
  echo -e "${CYAN}$label Summary${NC}"
  echo -e "  Total : $TOTAL_COUNT"
  echo -e "  ${GREEN}Pass  : $PASS_COUNT${NC}"
  if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "  ${RED}Fail  : $FAIL_COUNT${NC}"
  else
    echo -e "  Fail  : 0"
  fi
  echo -e "${CYAN}───────────────────────────────${NC}"
}

# Generate a unique suffix for test data
unique_id() {
  echo "$(date +%s)${RANDOM}"
}

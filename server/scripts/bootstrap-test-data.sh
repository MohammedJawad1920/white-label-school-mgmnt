#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# bootstrap-test-data.sh
# Creates the first admin user for the test tenant
# directly in the DB (chicken-and-egg: POST /users needs admin token)
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

TENANT_ID=$(get_state "TENANT_ID")
TENANT_SLUG=$(get_state "TENANT_SLUG")

if [[ -z "$TENANT_ID" || -z "$TENANT_SLUG" ]]; then
  echo "ERROR: TENANT_ID or TENANT_SLUG not found. Run SuperAdmin scripts first."
  exit 1
fi

section "Bootstrap — Create first Admin user via DB"

ADMIN_EMAIL="admin-$(unique_id)@test.com"
ADMIN_PASSWORD="TestAdmin@123"

save_state "ADMIN_EMAIL" "$ADMIN_EMAIL"
save_state "ADMIN_PASSWORD" "$ADMIN_PASSWORD"

# Use Node.js to hash password and insert user directly
# Change to server dir for dotenv
cd "$SCRIPT_DIR/.."

BOOTSTRAP_RESULT=$(node -e "
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const userId = 'U-' + uuidv4().slice(0, 8);
    const hash = await bcrypt.hash('${ADMIN_PASSWORD}', 10);

    await pool.query(
      \`INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES (\$1, \$2, \$3, \$4, \$5, \$6)\`,
      [userId, '${TENANT_ID}', 'Test Admin', '${ADMIN_EMAIL}', hash, JSON.stringify(['Admin'])]
    );

    // Also create a Teacher user
    const teacherId = 'U-' + uuidv4().slice(0, 8);
    const teacherEmail = 'teacher-' + Date.now() + '@test.com';
    const teacherHash = await bcrypt.hash('TestTeach@123', 10);

    await pool.query(
      \`INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES (\$1, \$2, \$3, \$4, \$5, \$6)\`,
      [teacherId, '${TENANT_ID}', 'Test Teacher', teacherEmail, teacherHash, JSON.stringify(['Teacher'])]
    );

    // Also create a multi-role user
    const multiId = 'U-' + uuidv4().slice(0, 8);
    const multiEmail = 'multi-' + Date.now() + '@test.com';
    const multiHash = await bcrypt.hash('TestMulti@123', 10);

    await pool.query(
      \`INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES (\$1, \$2, \$3, \$4, \$5, \$6)\`,
      [multiId, '${TENANT_ID}', 'Multi Role User', multiEmail, multiHash, JSON.stringify(['Admin','Teacher'])]
    );

    console.log(JSON.stringify({
      adminId: userId, adminEmail: '${ADMIN_EMAIL}',
      teacherId, teacherEmail,
      multiId, multiEmail
    }));
  } finally {
    await pool.end();
  }
})();
" 2>/tmp/wl-bootstrap-err.log) || true

if [[ -z "$BOOTSTRAP_RESULT" ]]; then
  echo -e "  ${RED}[FAIL]${NC} Bootstrap failed — node error:"
  cat /tmp/wl-bootstrap-err.log 2>/dev/null || true
  exit 1
fi
  ADMIN_ID=$(json_get "$BOOTSTRAP_RESULT" ".adminId")
  TEACHER_ID=$(json_get "$BOOTSTRAP_RESULT" ".teacherId")
  TEACHER_EMAIL=$(json_get "$BOOTSTRAP_RESULT" ".teacherEmail")
  MULTI_ID=$(json_get "$BOOTSTRAP_RESULT" ".multiId")
  MULTI_EMAIL=$(json_get "$BOOTSTRAP_RESULT" ".multiEmail")

  save_state "ADMIN_ID" "$ADMIN_ID"
  save_state "TEACHER_ID" "$TEACHER_ID"
  save_state "TEACHER_EMAIL" "$TEACHER_EMAIL"
  save_state "TEACHER_PASSWORD" "TestTeach@123"
  save_state "MULTI_ID" "$MULTI_ID"
  save_state "MULTI_EMAIL" "$MULTI_EMAIL"
  save_state "MULTI_PASSWORD" "TestMulti@123"

  echo -e "  ${GREEN}[PASS]${NC} Bootstrap Admin: $ADMIN_EMAIL (id: $ADMIN_ID)"
  echo -e "  ${GREEN}[PASS]${NC} Bootstrap Teacher: $TEACHER_EMAIL (id: $TEACHER_ID)"
  echo -e "  ${GREEN}[PASS]${NC} Bootstrap Multi-role: $MULTI_EMAIL (id: $MULTI_ID)"

section "Bootstrap — Login as Admin"

api_call POST "/auth/login" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"tenantSlug\":\"${TENANT_SLUG}\"}"

if [[ "$HTTP_STATUS" == "200" ]]; then
  ADMIN_TOKEN=$(json_body ".token")
  save_state "ADMIN_TOKEN" "$ADMIN_TOKEN"
  echo -e "  ${GREEN}[PASS]${NC} Admin login successful — token saved"
else
  echo -e "  ${RED}[FAIL]${NC} Admin login failed (HTTP $HTTP_STATUS)"
  echo -e "  ${RED}  Body: ${HTTP_BODY:0:300}${NC}"
  exit 1
fi

section "Bootstrap — Login as Teacher"

api_call POST "/auth/login" \
  "{\"email\":\"${TEACHER_EMAIL}\",\"password\":\"TestTeach@123\",\"tenantSlug\":\"${TENANT_SLUG}\"}"

if [[ "$HTTP_STATUS" == "200" ]]; then
  TEACHER_TOKEN=$(json_body ".token")
  save_state "TEACHER_TOKEN" "$TEACHER_TOKEN"
  echo -e "  ${GREEN}[PASS]${NC} Teacher login successful — token saved"
else
  echo -e "  ${RED}[FAIL]${NC} Teacher login failed (HTTP $HTTP_STATUS)"
fi

section "Bootstrap — Login as Multi-role user"

api_call POST "/auth/login" \
  "{\"email\":\"${MULTI_EMAIL}\",\"password\":\"TestMulti@123\",\"tenantSlug\":\"${TENANT_SLUG}\"}"

if [[ "$HTTP_STATUS" == "200" ]]; then
  MULTI_TOKEN=$(json_body ".token")
  save_state "MULTI_TOKEN" "$MULTI_TOKEN"
  echo -e "  ${GREEN}[PASS]${NC} Multi-role login successful — token saved"
else
  echo -e "  ${RED}[FAIL]${NC} Multi-role login failed (HTTP $HTTP_STATUS)"
fi

echo ""
echo -e "${GREEN}Bootstrap complete. All tokens saved to state.${NC}"

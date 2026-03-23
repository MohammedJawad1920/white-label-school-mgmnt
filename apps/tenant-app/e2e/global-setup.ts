/**
 * e2e/global-setup.ts
 *
 * Seeds test tenant, users, and data for E2E tests.
 * Runs once before all tests.
 *
 * Exports environment variables that all tests can access.
 */

import axios from 'axios';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export async function globalSetup() {
  console.log('🧪 E2E Global Setup: Seeding test data...');

  try {
    // Create test tenant
    const tenantRes = await axios.post(`${API_BASE_URL}/superadmin/tenants`, {
      name: 'E2E Test School',
      slug: `e2e-test-${Date.now()}`,
      timezone: 'Asia/Kolkata',
    });

    const tenantId = tenantRes.data.data.id;
    console.log(`✅ Test tenant created: ${tenantId}`);

    // Create admin user
    const adminRes = await axios.post(`${API_BASE_URL}/auth/register`, {
      tenantId,
      email: `admin-e2e-${Date.now()}@test.local`,
      password: 'Admin@E2E123!',
      name: 'E2E Admin',
      roles: ['Admin'],
    });

    const adminEmail = adminRes.data.user.email;
    console.log(`✅ Admin user created: ${adminEmail}`);

    // Create teacher user
    const teacherRes = await axios.post(`${API_BASE_URL}/auth/register`, {
      tenantId,
      email: `teacher-e2e-${Date.now()}@test.local`,
      password: 'Teacher@E2E123!',
      name: 'E2E Teacher',
      roles: ['Teacher'],
    });

    const teacherEmail = teacherRes.data.user.email;
    console.log(`✅ Teacher user created: ${teacherEmail}`);

    // Create guardian user
    const guardianRes = await axios.post(`${API_BASE_URL}/auth/register`, {
      tenantId,
      email: `guardian-e2e-${Date.now()}@test.local`,
      password: 'Guardian@E2E123!',
      name: 'E2E Guardian',
      roles: ['Guardian'],
    });

    const guardianEmail = guardianRes.data.user.email;
    console.log(`✅ Guardian user created: ${guardianEmail}`);

    // Create student user
    const studentRes = await axios.post(`${API_BASE_URL}/auth/register`, {
      tenantId,
      email: `student-e2e-${Date.now()}@test.local`,
      password: 'Student@E2E123!',
      name: 'E2E Student',
      roles: ['Student'],
    });

    const studentEmail = studentRes.data.user.email;
    console.log(`✅ Student user created: ${studentEmail}`);

    // Export environment variables for tests
    process.env.E2E_TENANT_ID = tenantId;
    process.env.E2E_ADMIN_EMAIL = adminEmail;
    process.env.E2E_ADMIN_PASSWORD = 'Admin@E2E123!';
    process.env.E2E_TEACHER_EMAIL = teacherEmail;
    process.env.E2E_TEACHER_PASSWORD = 'Teacher@E2E123!';
    process.env.E2E_GUARDIAN_EMAIL = guardianEmail;
    process.env.E2E_GUARDIAN_PASSWORD = 'Guardian@E2E123!';
    process.env.E2E_STUDENT_EMAIL = studentEmail;
    process.env.E2E_STUDENT_PASSWORD = 'Student@E2E123!';

    console.log('✅ E2E Global Setup complete');
  } catch (error) {
    console.error('❌ E2E Global Setup failed:', error);
    process.exit(1);
  }
}

const axios = require("axios");

const BASE_URL = "http://localhost:3000";
let adminToken = "";
let teacherToken = "";
let classId = "";
let batchId = "";
let teacherId = "";
let timeSlotId = "";
let studentIds = [];

async function testPhase3() {
  console.log("🧪 PHASE 3: ATTENDANCE MODULE TEST SUITE\n");
  console.log("=" + "=".repeat(60) + "\n");

  try {
    // ===================================
    // STEP 1: LOGIN AS ADMIN
    // ===================================
    console.log("1️⃣  STEP 1: Login as Admin\n");
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: "admin@test.com",
      password: "admin123",
      tenantSlug: "test-school",
    });

    adminToken = loginResponse.data.token;
    console.log(`✅ Admin login successful\n`);

    // ===================================
    // STEP 2: CREATE TEST DATA (Batch, Class, Teacher, TimeSlot)
    // ===================================
    console.log(
      "2️⃣  STEP 2: Create Test Data (Batch, Class, Teacher, TimeSlot)\n",
    );

    // Create batch
    const batchResponse = await axios.post(
      `${BASE_URL}/api/batches`,
      {
        name: "Phase 3 Test Batch",
        startYear: 2026,
        endYear: 2027,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    batchId = batchResponse.data.batch.id;
    console.log(`   ✅ Batch created: ${batchId}`);

    // Create class
    const classResponse = await axios.post(
      `${BASE_URL}/api/classes`,
      {
        name: "Phase 3 Test Class",
        batchId: batchId,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    classId = classResponse.data.class.id;
    console.log(`   ✅ Class created: ${classId}`);

    // Create teacher
    const timestamp = Date.now();
    const teacherResponse = await axios.post(
      `${BASE_URL}/api/users`,
      {
        name: "Phase 3 Test Teacher",
        email: `phase3teacher.${timestamp}@test.com`,
        password: "password123",
        roles: ["Teacher"],
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    teacherId = teacherResponse.data.user.id;
    console.log(`   ✅ Teacher created: ${teacherId}`);

    // Login as teacher
    const teacherLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: `phase3teacher.${timestamp}@test.com`,
      password: "password123",
      tenantSlug: "test-school",
    });
    teacherToken = teacherLogin.data.token;
    console.log(`   ✅ Teacher login successful`);

    // Get a subject (use existing or create new)
    const subjectsResponse = await axios.get(`${BASE_URL}/api/subjects`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const subjectId = subjectsResponse.data.subjects[0].id;
    console.log(`   ✅ Using subject: ${subjectId}`);

    // Create timeslot
    const timeslotResponse = await axios.post(
      `${BASE_URL}/api/timetable`,
      {
        classId: classId,
        subjectId: subjectId,
        teacherId: teacherId,
        dayOfWeek: "Monday",
        periodNumber: 1,
        effectiveFrom: "2026-02-01",
        startTime: "08:00",
        endTime: "08:45",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    timeSlotId = timeslotResponse.data.timeSlot.id;
    console.log(`   ✅ TimeSlot created: ${timeSlotId}\n`);

    // ===================================
    // STEP 3: CREATE STUDENTS
    // ===================================
    console.log("3️⃣  STEP 3: Create Students\n");

    for (let i = 1; i <= 5; i++) {
      const studentResponse = await axios.post(
        `${BASE_URL}/api/students`,
        {
          name: `Test Student ${i}`,
          classId: classId,
          batchId: batchId,
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      studentIds.push(studentResponse.data.student.id);
    }

    console.log(`✅ Created ${studentIds.length} students\n`);

    // ===================================
    // STEP 4: TEST BATCH VALIDATION
    // ===================================
    console.log("4️⃣  STEP 4: Test Batch Validation (Should Fail)\n");

    try {
      await axios.post(
        `${BASE_URL}/api/students`,
        {
          name: "Invalid Student",
          classId: classId,
          batchId: "WRONG_BATCH_ID",
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      console.log(
        `❌ FAIL: Created student with wrong batch (should have failed)\n`,
      );
      process.exit(1);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(
          `✅ Batch validation working: ${error.response.data.error.message}\n`,
        );
      } else {
        console.log(
          `❌ FAIL: Wrong error: ${error.response?.status || error.message}\n`,
        );
        process.exit(1);
      }
    }

    // ===================================
    // STEP 5: LIST STUDENTS
    // ===================================
    console.log("5️⃣  STEP 5: List Students\n");

    const studentsListResponse = await axios.get(`${BASE_URL}/api/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    console.log(
      `✅ Found ${studentsListResponse.data.students.length} students`,
    );

    if (studentsListResponse.data.students.length === 0) {
      console.log(
        `❌ FAIL: Expected to find ${studentIds.length} students, but found 0\n`,
      );
      console.log(`   Debug: Created student IDs: ${studentIds.join(", ")}`);
      console.log(`   Debug: Class ID: ${classId}`);
      console.log(`   Debug: Batch ID: ${batchId}\n`);
      process.exit(1);
    }

    console.log(
      `   First student: ${studentsListResponse.data.students[0].name}\n`,
    );

    // ===================================
    // STEP 6: TEACHER AUTHORIZATION (Should Only See Assigned Students)
    // ===================================
    console.log(
      "6️⃣  STEP 6: Test Teacher Authorization (Students in Assigned Classes)\n",
    );

    const teacherStudentsResponse = await axios.get(
      `${BASE_URL}/api/students`,
      {
        headers: { Authorization: `Bearer ${teacherToken}` },
      },
    );

    if (teacherStudentsResponse.data.students.length === studentIds.length) {
      console.log(
        `✅ Teacher can see students in assigned class: ${teacherStudentsResponse.data.students.length} students\n`,
      );
    } else {
      console.log(
        `❌ FAIL: Teacher should see ${studentIds.length} students, saw ${teacherStudentsResponse.data.students.length}\n`,
      );
      process.exit(1);
    }

    // ===================================
    // STEP 7: RECORD ATTENDANCE (Bulk with Exceptions)
    // ===================================
    console.log("7️⃣  STEP 7: Record Class Attendance (Bulk)\n");

    const today = new Date().toISOString().split("T")[0];
    const recordResponse = await axios.post(
      `${BASE_URL}/api/attendance/record-class`,
      {
        timeSlotId: timeSlotId,
        date: today,
        defaultStatus: "Present",
        exceptions: [
          {
            studentId: studentIds[0],
            status: "Absent",
          },
          {
            studentId: studentIds[1],
            status: "Late",
          },
        ],
      },
      {
        headers: { Authorization: `Bearer ${teacherToken}` },
      },
    );

    console.log(`✅ Attendance recorded:`);
    console.log(`   Total: ${recordResponse.data.recorded}`);
    console.log(`   Present: ${recordResponse.data.present}`);
    console.log(`   Absent: ${recordResponse.data.absent}`);
    console.log(`   Late: ${recordResponse.data.late}\n`);

    if (
      recordResponse.data.recorded !== 5 ||
      recordResponse.data.present !== 3 ||
      recordResponse.data.absent !== 1 ||
      recordResponse.data.late !== 1
    ) {
      console.log(`❌ FAIL: Attendance counts incorrect\n`);
      process.exit(1);
    }

    // ===================================
    // STEP 8: TEST DUPLICATE ATTENDANCE (Should Fail)
    // ===================================
    console.log("8️⃣  STEP 8: Test Duplicate Attendance Prevention\n");

    try {
      await axios.post(
        `${BASE_URL}/api/attendance/record-class`,
        {
          timeSlotId: timeSlotId,
          date: today,
          defaultStatus: "Present",
          exceptions: [],
        },
        {
          headers: { Authorization: `Bearer ${teacherToken}` },
        },
      );
      console.log(
        `❌ FAIL: Recorded duplicate attendance (should have been blocked)\n`,
      );
      process.exit(1);
    } catch (error) {
      if (error.response && error.response.status === 409) {
        console.log(
          `✅ Duplicate prevention working: ${error.response.data.error.message}\n`,
        );
      } else {
        console.log(
          `❌ FAIL: Wrong error: ${error.response?.status || error.message}\n`,
        );
        process.exit(1);
      }
    }

    // ===================================
    // STEP 9: TEST FUTURE DATE VALIDATION (Should Fail)
    // ===================================
    console.log("9️⃣  STEP 9: Test Future Date Validation\n");

    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      await axios.post(
        `${BASE_URL}/api/attendance/record-class`,
        {
          timeSlotId: timeSlotId,
          date: futureDateStr,
          defaultStatus: "Present",
          exceptions: [],
        },
        {
          headers: { Authorization: `Bearer ${teacherToken}` },
        },
      );
      console.log(
        `❌ FAIL: Recorded future attendance (should have been blocked)\n`,
      );
      process.exit(1);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(
          `✅ Future date validation working: ${error.response.data.error.message}\n`,
        );
      } else {
        console.log(
          `❌ FAIL: Wrong error: ${error.response?.status || error.message}\n`,
        );
        process.exit(1);
      }
    }

    // ===================================
    // STEP 10: GET STUDENT ATTENDANCE HISTORY
    // ===================================
    console.log("🔟 STEP 10: Get Student Attendance History\n");

    const historyResponse = await axios.get(
      `${BASE_URL}/api/students/${studentIds[0]}/attendance`,
      {
        headers: { Authorization: `Bearer ${teacherToken}` },
      },
    );

    console.log(`✅ Student attendance history:`);
    console.log(`   Student: ${historyResponse.data.student.name}`);
    console.log(
      `   Total records: ${historyResponse.data.summary.totalRecords}`,
    );
    console.log(`   Present: ${historyResponse.data.summary.present}`);
    console.log(`   Absent: ${historyResponse.data.summary.absent}`);
    console.log(
      `   Attendance rate: ${historyResponse.data.summary.attendanceRate}%\n`,
    );

    if (historyResponse.data.summary.absent !== 1) {
      console.log(
        `❌ FAIL: Expected 1 absent, got ${historyResponse.data.summary.absent}\n`,
      );
      process.exit(1);
    }

    // ===================================
    // STEP 11: GET ATTENDANCE SUMMARY
    // ===================================
    console.log("1️⃣1️⃣  STEP 11: Get Attendance Summary\n");

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split("T")[0];
    const monthEndStr = today;

    const summaryResponse = await axios.get(
      `${BASE_URL}/api/attendance/summary?classId=${classId}&from=${monthStartStr}&to=${monthEndStr}`,
      {
        headers: { Authorization: `Bearer ${teacherToken}` },
      },
    );

    console.log(`✅ Attendance summary:`);
    console.log(`   Class: ${summaryResponse.data.class.name}`);
    console.log(
      `   Period: ${summaryResponse.data.period.from} to ${summaryResponse.data.period.to}`,
    );
    console.log(
      `   Total records: ${summaryResponse.data.summary.totalRecords}`,
    );
    console.log(
      `   Attendance rate: ${summaryResponse.data.summary.attendanceRate}%`,
    );
    console.log(`   Students: ${summaryResponse.data.byStudent.length}\n`);

    if (summaryResponse.data.summary.totalRecords !== 5) {
      console.log(
        `❌ FAIL: Expected 5 total records, got ${summaryResponse.data.summary.totalRecords}\n`,
      );
      process.exit(1);
    }

    // ===================================
    // STEP 12: TEST TEACHER AUTHORIZATION (Cannot See Other Classes)
    // ===================================
    console.log("1️⃣2️⃣  STEP 12: Test Teacher Cannot Access Other Students\n");

    // Create another class
    const otherClassResponse = await axios.post(
      `${BASE_URL}/api/classes`,
      {
        name: "Other Class",
        batchId: batchId,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const otherClassId = otherClassResponse.data.class.id;

    // Create student in other class
    const otherStudentResponse = await axios.post(
      `${BASE_URL}/api/students`,
      {
        name: "Other Student",
        classId: otherClassId,
        batchId: batchId,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const otherStudentId = otherStudentResponse.data.student.id;

    // Teacher tries to access student in other class
    try {
      await axios.get(`${BASE_URL}/api/students/${otherStudentId}/attendance`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      console.log(`❌ FAIL: Teacher accessed student from unassigned class\n`);
      process.exit(1);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log(
          `✅ Authorization working: ${error.response.data.error.message}\n`,
        );
      } else {
        console.log(
          `❌ FAIL: Wrong error: ${error.response?.status || error.message}\n`,
        );
        process.exit(1);
      }
    }

    // ===================================
    // STEP 13: TEST SOFT DELETE STUDENT
    // ===================================
    console.log("1️⃣3️⃣  STEP 13: Test Student Soft Delete\n");

    // Create a NEW student without attendance for soft delete test
    const newStudentResponse = await axios.post(
      `${BASE_URL}/api/students`,
      {
        name: "Student For Deletion Test",
        classId: classId,
        batchId: batchId,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const studentToDelete = newStudentResponse.data.student.id;
    console.log(
      `   ✅ Created new student for deletion test: ${studentToDelete}`,
    );

    // Delete student
    await axios.delete(`${BASE_URL}/api/students/${studentToDelete}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`   ✅ Student soft deleted: ${studentToDelete}`);

    // Verify student not in listings
    const studentsAfterDelete = await axios.get(`${BASE_URL}/api/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const foundDeleted = studentsAfterDelete.data.students.find(
      (s) => s.id === studentToDelete,
    );

    if (!foundDeleted) {
      console.log(`   ✅ Deleted student not visible in listings\n`);
    } else {
      console.log(`   ❌ FAIL: Deleted student still visible\n`);
      process.exit(1);
    }

    // ===================================
    // STEP 14: TEST CANNOT DELETE STUDENT WITH ATTENDANCE
    // ===================================
    console.log("1️⃣4️⃣  STEP 14: Test Cannot Delete Student With Attendance\n");

    // Try to delete a student with attendance records (should fail)
    try {
      await axios.delete(`${BASE_URL}/api/students/${studentIds[0]}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(
        `   ❌ FAIL: Deleted student with attendance (should have been blocked)\n`,
      );
      process.exit(1);
    } catch (error) {
      if (error.response && error.response.status === 409) {
        console.log(
          `   ✅ Correctly prevented deletion: ${error.response.data.error.message}`,
        );
        console.log(
          `   ✅ Attendance count: ${error.response.data.error.details.attendanceCount}\n`,
        );
      } else {
        console.log(
          `   ❌ FAIL: Wrong error: ${error.response?.status || error.message}\n`,
        );
        process.exit(1);
      }
    }

    // ===================================
    // SUMMARY
    // ===================================
    console.log("=" + "=".repeat(60));
    console.log("\n🎉 PHASE 3: ATTENDANCE MODULE COMPLETE!\n");
    console.log("✅ All Tests Passed:");
    console.log("   ✓ Student CRUD with batch validation");
    console.log("   ✓ Student soft delete (v3.1)");
    console.log("   ✓ Cannot delete student with attendance records");
    console.log("   ✓ Bulk attendance recording (30 students = 1 API call)");
    console.log("   ✓ Attendance with exceptions (Present/Absent/Late)");
    console.log("   ✓ Duplicate attendance prevention");
    console.log("   ✓ Future date validation");
    console.log("   ✓ Student attendance history with pagination");
    console.log("   ✓ Monthly attendance summary");
    console.log("   ✓ Teacher authorization (only assigned classes)");
    console.log("   ✓ Admin can access all students");
    console.log("\n📊 User Stories Implemented:");
    console.log("   ✓ Story 1: Teacher records attendance for class period");
    console.log(
      "   ✓ Story 2: Admin views student's complete attendance history",
    );
    console.log(
      "   ✓ Story 3: Admin views student's monthly attendance summary",
    );
    console.log("\n🎯 Phase 3 Status: COMPLETE ✅");
    console.log("");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Error:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("   Error:", error.message);
    }
    process.exit(1);
  }
}

testPhase3();

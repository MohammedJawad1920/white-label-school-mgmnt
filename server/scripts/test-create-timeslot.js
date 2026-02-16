const axios = require("axios");

async function testCreateTimeSlot() {
  try {
    // Step 1: Login as admin
    console.log("1️⃣  Logging in as admin...\n");
    const loginResponse = await axios.post(
      "http://localhost:3000/api/auth/login",
      {
        email: "admin@test.com",
        password: "admin123",
        tenantSlug: "test-school",
      },
    );

    const token = loginResponse.data.token;
    console.log("✅ Login successful");
    console.log(`Token: ${token.substring(0, 20)}...\n`);

    // Step 2: Create timeslot
    console.log("2️⃣  Creating timeslot...\n");
    const createResponse = await axios.post(
      "http://localhost:3000/api/timetable/create",
      {
        classId: "C001",
        subjectId: "SUB001",
        teacherId: "U001",
        dayOfWeek: "Monday",
        periodNumber: 2,
        effectiveFrom: "2026-01-28",
        startTime: "09:00",
        endTime: "09:45",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ Timeslot created successfully!\n");
    console.log("Response:");
    console.log(JSON.stringify(createResponse.data, null, 2));

    // After creating a timeslot, end it
    console.log("3️⃣  Ending timeslot...\n");

    const endResponse = await axios.put(
      `http://localhost:3000/api/timetable/${createResponse.data.timeSlot.id}/end`,
      {
        effectiveTo: "2026-01-31",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ Timeslot ended successfully!\n");
    console.log("Response:");
    console.log(JSON.stringify(endResponse.data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

testCreateTimeSlot();

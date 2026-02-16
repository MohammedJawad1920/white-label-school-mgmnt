const axios = require("axios");

async function testGetTimetable() {
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
    console.log("✅ Login successful\n");

    // Step 2: Get all active timetables
    console.log("2️⃣  Fetching all active timetables...\n");
    const allResponse = await axios.get("http://localhost:3000/api/timetable", {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("✅ Active timetables:");
    console.log(JSON.stringify(allResponse.data, null, 2));
    console.log(
      `\n   Found ${allResponse.data.timetable.length} active slot(s)\n`,
    );

    // Step 3: Get timetable for specific date
    console.log("3️⃣  Fetching timetable for 2026-01-30...\n");
    const dateResponse = await axios.get(
      "http://localhost:3000/api/timetable?date=2026-01-30",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    console.log("✅ Timetables on 2026-01-30:");
    console.log(JSON.stringify(dateResponse.data, null, 2));
    console.log(
      `\n   Found ${dateResponse.data.timetable.length} slot(s) on that date\n`,
    );

    // Step 4: Get timetable for Monday only
    console.log("4️⃣  Fetching Monday timetables...\n");
    const mondayResponse = await axios.get(
      "http://localhost:3000/api/timetable?dayOfWeek=Monday&status=Active",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    console.log("✅ Monday active timetables:");
    console.log(JSON.stringify(mondayResponse.data, null, 2));
    console.log(
      `\n   Found ${mondayResponse.data.timetable.length} Monday slot(s)\n`,
    );
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

testGetTimetable();

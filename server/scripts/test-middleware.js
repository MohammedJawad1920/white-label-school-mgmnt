const jwt = require("jsonwebtoken");
require("dotenv").config();

// Generate a test token
const testToken = jwt.sign(
  {
    userId: "U001",
    tenantId: "schoolA",
    roles: ["Teacher"],
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

console.log("Test JWT token:");
console.log(testToken);
console.log("\nDecoded payload:");
console.log(jwt.decode(testToken));

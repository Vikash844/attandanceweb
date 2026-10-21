import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { connectToDatabase } from "../lib/db";
import { Employee } from "../lib/models";

async function main() {
  config({ path: ".env.local" });
  const { ADMIN_EMPLOYEE_ID, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMPLOYEE_ID || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_EMPLOYEE_ID, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before seeding.");
  }
  if (ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  await connectToDatabase();
  const existing = await Employee.findOne({
    $or: [
      { employeeId: ADMIN_EMPLOYEE_ID.toUpperCase() },
      { email: ADMIN_EMAIL.toLowerCase() }
    ]
  });
  if (existing) throw new Error("An account with that employee ID or email already exists.");
  await Employee.create({
    employeeId: ADMIN_EMPLOYEE_ID.toUpperCase(),
    name: ADMIN_NAME,
    email: ADMIN_EMAIL.toLowerCase(),
    department: "Administration",
    designation: "System Administrator",
    joiningDate: new Date(),
    role: "admin",
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12)
  });
  console.info(`Created administrator account ${ADMIN_EMPLOYEE_ID.toUpperCase()}.`);
  await (await import("mongoose")).default.disconnect();
}

main().catch(async (error: unknown) => {
  console.error("Unable to create administrator:", error);
  await (await import("mongoose")).default.disconnect();
  process.exitCode = 1;
});

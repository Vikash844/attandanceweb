import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/lib/models";
import { apiError, attachSession, createSession, HttpError } from "@/lib/session";

const adminSchema = z.object({
  employeeId: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
});

function verifySetupKey(providedKey: string | null, configuredKey: string) {
  if (!providedKey) return false;
  const providedHash = createHash("sha256").update(providedKey).digest();
  const configuredHash = createHash("sha256").update(configuredKey).digest();
  return timingSafeEqual(providedHash, configuredHash);
}

export async function POST(request: Request) {
  try {
    const setupKey = process.env.ADMIN_SETUP_KEY;
    if (!setupKey || setupKey.length < 32) {
      throw new HttpError("First-admin setup is not configured. Set ADMIN_SETUP_KEY to a random secret of at least 32 characters.", 503);
    }
    if (!verifySetupKey(request.headers.get("x-admin-setup-key"), setupKey)) {
      throw new HttpError("Invalid setup key.", 401);
    }

    const admin = adminSchema.parse({
      employeeId: process.env.ADMIN_EMPLOYEE_ID,
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });

    await connectToDatabase();
    await Employee.init();
    if (await Employee.exists({ role: "admin" })) {
      throw new HttpError("First-admin setup has already been completed.", 409);
    }
    if (await Employee.exists({
      $or: [
        { employeeId: admin.employeeId.toUpperCase() },
        { email: admin.email.toLowerCase() }
      ]
    })) {
      throw new HttpError("The configured admin ID or email is already used by another account.", 409);
    }

    const employee = await Employee.create({
      employeeId: admin.employeeId.toUpperCase(),
      name: admin.name,
      email: admin.email.toLowerCase(),
      department: "Administration",
      designation: "System Administrator",
      joiningDate: new Date(),
      role: "admin",
      passwordHash: await bcrypt.hash(admin.password, 12)
    });
    const token = await createSession({
      id: employee._id.toString(),
      employeeId: employee.employeeId,
      name: employee.name,
      role: "admin"
    });

    return attachSession(NextResponse.json({
      user: {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role
      }
    }, { status: 201 }), token);
  } catch (error) {
    return apiError(error);
  }
}

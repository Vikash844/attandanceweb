import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/lib/models";
import { apiError, attachSession, createSession, HttpError } from "@/lib/session";

const loginSchema = z.object({
  employeeId: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128)
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    await connectToDatabase();
    const employee = await Employee.findOne({
      employeeId: body.employeeId.toUpperCase(),
      status: "active"
    }).select("+passwordHash");
    if (!employee) {
      if (!(await Employee.exists({ role: "admin" }))) {
        throw new HttpError("No admin account exists yet. Complete first-time setup before signing in.", 409);
      }
      return NextResponse.json({ error: "Employee ID or password is incorrect." }, { status: 401 });
    }
    if (!(await bcrypt.compare(body.password, employee.passwordHash))) {
      return NextResponse.json({ error: "Employee ID or password is incorrect." }, { status: 401 });
    }
    const token = await createSession({
      id: employee._id.toString(),
      employeeId: employee.employeeId,
      name: employee.name,
      role: employee.role as "admin" | "hr" | "employee"
    });
    return attachSession(NextResponse.json({
      user: {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role
      }
    }), token);
  } catch (error) {
    return apiError(error);
  }
}

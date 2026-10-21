import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/lib/models";
import { apiError, requireRole, requireUser } from "@/lib/session";

const employeeSchema = z.object({
  employeeId: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  department: z.string().trim().min(2).max(80),
  designation: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(24).default(""),
  joiningDate: z.coerce.date(),
  salary: z.coerce.number().min(0).default(0),
  role: z.enum(["admin", "hr", "employee"]).default("employee"),
  password: z.string().min(8).max(128)
});

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    if (user.role === "employee") {
      const employee = await Employee.findById(user.id).select("-passwordHash -salary").lean();
      return NextResponse.json({ employees: employee ? [employee] : [] });
    }
    requireRole(user, ["admin", "hr"]);
    const employees = await Employee.find().select("-passwordHash").sort({ name: 1 }).lean();
    return NextResponse.json({ employees });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["admin", "hr"]);
    const body = employeeSchema.parse(await request.json());
    if (body.role !== "employee") requireRole(user, ["admin"]);
    await connectToDatabase();
    const passwordHash = await bcrypt.hash(body.password, 12);
    const employee = await Employee.create({
      ...body,
      employeeId: body.employeeId.toUpperCase(),
      passwordHash
    });
    return NextResponse.json({
      employee: await Employee.findById(employee._id).select("-passwordHash").lean()
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

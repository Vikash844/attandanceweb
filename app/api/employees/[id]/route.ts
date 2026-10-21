import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/lib/models";
import { apiError, HttpError, requireRole, requireUser } from "@/lib/session";

const updateSchema = z.object({
  employeeId: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  department: z.string().trim().min(2).max(80).optional(),
  designation: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(24).optional(),
  joiningDate: z.coerce.date().optional(),
  salary: z.coerce.number().min(0).optional(),
  role: z.enum(["admin", "hr", "employee"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  password: z.string().min(8).max(128).optional()
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    requireRole(user, ["admin", "hr"]);
    const body = updateSchema.parse(await request.json());
    if (body.role !== undefined) requireRole(user, ["admin"]);
    if (body.status !== undefined) requireRole(user, ["admin"]);
    await connectToDatabase();
    const { id } = await context.params;
    const current = await Employee.findById(id).select("role status");
    if (!current) throw new HttpError("Employee not found.", 404);
    if (id === user.id && body.role !== undefined && body.role !== "admin") {
      throw new HttpError("You cannot remove your own administrator access.", 400);
    }
    if (id === user.id && body.status === "inactive") {
      throw new HttpError("You cannot deactivate your own account.", 400);
    }
    const removingActiveAdmin =
      current.role === "admin" &&
      current.status === "active" &&
      ((body.role !== undefined && body.role !== "admin") || body.status === "inactive");
    if (removingActiveAdmin) {
      const otherAdmins = await Employee.countDocuments({
        _id: { $ne: current._id },
        role: "admin",
        status: "active"
      });
      if (otherAdmins === 0) throw new HttpError("The last active administrator cannot be removed.", 400);
    }
    const changes: Record<string, unknown> = { ...body };
    if (body.employeeId) changes.employeeId = body.employeeId.toUpperCase();
    if (body.password) changes.passwordHash = await bcrypt.hash(body.password, 12);
    delete changes.password;
    const employee = await Employee.findByIdAndUpdate(id, changes, {
      new: true,
      runValidators: true
    }).select("-passwordHash").lean();
    if (!employee) throw new HttpError("Employee not found.", 404);
    return NextResponse.json({ employee });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    requireRole(user, ["admin"]);
    const { id } = await context.params;
    if (id === user.id) throw new HttpError("You cannot deactivate your own account.", 400);
    await connectToDatabase();
    const current = await Employee.findById(id).select("role status");
    if (!current) throw new HttpError("Employee not found.", 404);
    if (current.role === "admin" && current.status === "active") {
      const otherAdmins = await Employee.countDocuments({
        _id: { $ne: current._id },
        role: "admin",
        status: "active"
      });
      if (otherAdmins === 0) throw new HttpError("The last active administrator cannot be removed.", 400);
    }
    const employee = await Employee.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
    if (!employee) throw new HttpError("Employee not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

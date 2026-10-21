import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { getLocalDateKey, getLocalTime, isWithinWindow } from "@/lib/attendance-time";
import { Attendance, Employee, Settings } from "@/lib/models";
import { apiError, HttpError, requireRole, requireUser } from "@/lib/session";

const actionSchema = z.object({ action: z.enum(["check-in", "check-out"]) });

export async function GET() {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const settings = await Settings.findOne({ key: "attendance" }).lean();
    const timezone = settings?.timezone ?? "Asia/Kolkata";
    const today = getLocalDateKey(new Date(), timezone);
    const filter = user.role === "employee"
      ? { employee: user.id }
      : (requireRole(user, ["admin", "hr"]), {});
    const records = await Attendance.find(filter)
      .sort({ dateKey: -1, checkIn: -1 })
      .limit(100)
      .populate("employee", "employeeId name department designation")
      .lean();
    const activeEmployeeIds = user.role === "employee"
      ? []
      : await Employee.find({ status: "active" }).distinct("_id");
    const employees = activeEmployeeIds.length;
    const todayPresent = user.role === "employee"
      ? records.filter((record) => record.dateKey === today && record.checkIn).length
      : await Attendance.countDocuments({
          dateKey: today,
          employee: { $in: activeEmployeeIds },
          checkIn: { $ne: null }
        });
    return NextResponse.json({
      records,
      today,
      activeEmployees: employees,
      todayPresent
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { action } = actionSchema.parse(await request.json());
    await connectToDatabase();
    const settings = await Settings.findOneAndUpdate(
      { key: "attendance" },
      { $setOnInsert: { key: "attendance" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const now = new Date();
    const timezone = settings.timezone ?? "Asia/Kolkata";
    const dateKey = getLocalDateKey(now, timezone);
    const localTime = getLocalTime(now, timezone);
    const checkInAllowed = isWithinWindow(localTime, settings.checkInStart, settings.checkInEnd);
    const checkOutAllowed = isWithinWindow(localTime, settings.checkOutStart, settings.checkOutEnd);
    if (action === "check-in" && !checkInAllowed) {
      throw new HttpError(`Check-in is available from ${settings.checkInStart} to ${settings.checkInEnd} (${timezone}).`, 400);
    }
    if (action === "check-out" && !checkOutAllowed) {
      throw new HttpError(`Check-out is available from ${settings.checkOutStart} to ${settings.checkOutEnd} (${timezone}).`, 400);
    }
    const existing = await Attendance.findOne({ employee: user.id, dateKey });
    if (action === "check-in") {
      if (existing?.checkIn) throw new HttpError("You have already checked in today.", 409);
      const late = localTime > settings.checkInStart;
      const record = existing
        ? await Attendance.findByIdAndUpdate(existing._id, { checkIn: now, status: late ? "late" : "present" }, { new: true })
        : await Attendance.create({ employee: user.id, dateKey, checkIn: now, status: late ? "late" : "present" });
      return NextResponse.json({ record }, { status: existing ? 200 : 201 });
    }
    if (!existing?.checkIn) throw new HttpError("Check in before checking out.", 400);
    if (existing.checkOut) throw new HttpError("You have already checked out today.", 409);
    const record = await Attendance.findByIdAndUpdate(existing._id, { checkOut: now }, { new: true });
    return NextResponse.json({ record });
  } catch (error) {
    return apiError(error);
  }
}

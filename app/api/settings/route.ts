import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Settings } from "@/lib/models";
import { apiError, requireRole, requireUser } from "@/lib/session";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const settingsSchema = z.object({
  checkInStart: time,
  checkInEnd: time,
  checkOutStart: time,
  checkOutEnd: time,
  timezone: z.string().trim().min(1).max(64)
}).refine((values) => values.checkInStart <= values.checkInEnd, {
  message: "Check-in start must be before check-in end.",
  path: ["checkInEnd"]
}).refine((values) => values.checkOutStart <= values.checkOutEnd, {
  message: "Check-out start must be before check-out end.",
  path: ["checkOutEnd"]
});

export async function GET() {
  try {
    await requireUser();
    await connectToDatabase();
    const settings = await Settings.findOneAndUpdate(
      { key: "attendance" },
      { $setOnInsert: { key: "attendance" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["admin", "hr"]);
    const body = settingsSchema.parse(await request.json());
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
    } catch {
      return NextResponse.json({ error: "Please provide a valid IANA timezone." }, { status: 400 });
    }
    await connectToDatabase();
    const settings = await Settings.findOneAndUpdate(
      { key: "attendance" },
      { $set: body, $setOnInsert: { key: "attendance" } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}

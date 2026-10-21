import { NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/session";

export async function GET() {
  try {
    return NextResponse.json({ user: await requireUser() });
  } catch (error) {
    return apiError(error);
  }
}

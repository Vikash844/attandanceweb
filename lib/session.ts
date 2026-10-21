import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Employee } from "@/lib/models";

export type Role = "admin" | "hr" | "employee";
export type SessionUser = {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
};

const cookieName = "workforce_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());
}

export function attachSession(response: NextResponse, token: string) {
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}

export function clearSession(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) throw new HttpError("Please sign in to continue.", 401);
  let claims: SessionUser;
  try {
    const verified = await jwtVerify(token, secretKey());
    claims = verified.payload as unknown as SessionUser;
  } catch {
    throw new HttpError("Your session has expired. Please sign in again.", 401);
  }
  await connectToDatabase();
  const employee = await Employee.findById(claims.id).select("_id employeeId name role status");
  if (!employee || employee.status !== "active") {
    throw new HttpError("This account is no longer active.", 401);
  }
  return {
    id: employee._id.toString(),
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role as Role
  };
}

export function requireRole(user: SessionUser, roles: Role[]) {
  if (!roles.includes(user.role)) throw new HttpError("You do not have permission to do that.", 403);
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Please check the submitted values." }, { status: 400 });
  }
  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    return NextResponse.json({ error: "A record with these details already exists." }, { status: 409 });
  }
  console.error("API request failed:", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

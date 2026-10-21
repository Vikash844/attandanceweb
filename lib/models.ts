import mongoose, { type InferSchemaType } from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    joiningDate: { type: Date, required: true },
    salary: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ["admin", "hr", "employee"], default: "employee", required: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true }
  },
  { timestamps: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    dateKey: { type: String, required: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: { type: String, enum: ["present", "late"], default: "present", required: true }
  },
  { timestamps: true }
);
attendanceSchema.index({ employee: 1, dateKey: 1 }, { unique: true });

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "attendance" },
    checkInStart: { type: String, default: "08:30" },
    checkInEnd: { type: String, default: "10:00" },
    checkOutStart: { type: String, default: "17:00" },
    checkOutEnd: { type: String, default: "20:00" },
    timezone: { type: String, default: "Asia/Kolkata" }
  },
  { timestamps: true }
);

export type EmployeeRecord = InferSchemaType<typeof employeeSchema>;
export type AttendanceRecord = InferSchemaType<typeof attendanceSchema>;
export type AttendanceSettings = InferSchemaType<typeof settingsSchema>;

export const Employee =
  (mongoose.models.Employee as mongoose.Model<EmployeeRecord>) ??
  mongoose.model<EmployeeRecord>("Employee", employeeSchema);
export const Attendance =
  (mongoose.models.Attendance as mongoose.Model<AttendanceRecord>) ??
  mongoose.model<AttendanceRecord>("Attendance", attendanceSchema);
export const Settings =
  (mongoose.models.Settings as mongoose.Model<AttendanceSettings>) ??
  mongoose.model<AttendanceSettings>("Settings", settingsSchema);

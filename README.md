# Shiftly — employee and attendance management

A full-stack employee management and attendance app built with Next.js App Router, TypeScript, MongoDB, and Mongoose. Admins and HR manage employee profiles, roles, and attendance windows; employees sign in with their employee ID and password to record their own attendance.

## Get started

1. Install Node.js 20.19 or newer.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` (`cp .env.example .env.local`) and replace every placeholder:
   - `MONGODB_URI`: your MongoDB Atlas connection string, including the database name.
   - `AUTH_SECRET`: a random secret of at least 32 characters.
   - `ADMIN_EMPLOYEE_ID`, `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`: the first admin account. Use a strong password of at least 12 characters.
   - `ADMIN_SETUP_KEY`: a separate random secret of at least 32 characters, used only for first-time setup.
4. In MongoDB Atlas, allow the application host in Network Access and ensure the database user has read/write access to the selected database.
5. Start the app: `npm run dev`, then open [http://localhost:3000](http://localhost:3000).
6. Create the first admin by calling the one-time setup endpoint:

   ```sh
   curl -X POST http://localhost:3000/api/auth/setup \
     -H "x-admin-setup-key: YOUR_ADMIN_SETUP_KEY"
   ```

   The endpoint creates the admin from `ADMIN_EMPLOYEE_ID`, `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then returns a login session cookie. It returns a conflict if any admin already exists. Alternatively, seed the admin directly with `npm run create-admin`.
7. Sign in at the app using the configured `ADMIN_EMPLOYEE_ID` and `ADMIN_PASSWORD`.

The app does not load credentials from `.env.example`; it is only a template. Put real values in `.env.local`, then restart `npm run dev`. The MongoDB URI should stay in `.env.local`; never commit credentials. The URI has the form `mongodb+srv://<username>:<url-encoded-password>@<cluster-host>/<database-name>`. URL-encode special characters in the database password.

Generate the two application secrets separately, for example with `openssl rand -base64 32`. Never use the example placeholder values as production secrets.

## Roles and features

- **Admin:** manage employee profiles and roles, deactivate accounts, view team attendance, and set attendance windows.
- **HR:** manage employee profiles (but cannot grant admin access), view team attendance, and configure attendance windows.
- **Employee:** sign in with employee ID and password, see their profile and attendance history, and check in/out within the configured time windows.
- **Attendance windows:** check-in and check-out each have start/end times. The configured IANA timezone is used for window checks and daily attendance records.
- **Employee offboarding:** deactivation preserves historical attendance while preventing further sign-in.

Passwords are stored as bcrypt hashes. Login sessions use signed, HTTP-only, same-site cookies and expire after eight hours. Salary information is available only to Admin and HR accounts.

## Checks

Run `npm run typecheck`, `npm run lint`, and `npm run build`.

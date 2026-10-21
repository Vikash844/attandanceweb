"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Role = "admin" | "hr" | "employee";
type User = { id: string; employeeId: string; name: string; role: Role };
type Employee = {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  phone: string;
  joiningDate: string;
  salary: number;
  role: Role;
  status: "active" | "inactive";
};
type Attendance = {
  _id: string;
  dateKey: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: "present" | "late";
  employee: Pick<Employee, "employeeId" | "name" | "department" | "designation"> | string;
};
type Settings = {
  checkInStart: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  timezone: string;
};
type Page = "overview" | "employees" | "attendance" | "settings";
type EmployeeForm = Omit<Employee, "_id" | "status"> & { password: string };

const emptyForm: EmployeeForm = {
  employeeId: "", name: "", email: "", department: "", designation: "", phone: "",
  joiningDate: new Date().toISOString().slice(0, 10), salary: 0, role: "employee", password: ""
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
  return result as T;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function clock(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function humanDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function employeeOf(record: Attendance) {
  return typeof record.employee === "string" ? null : record.employee;
}

function Avatar({ name, color = "mint" }: { name: string; color?: string }) {
  return <span className={`avatar avatar-${color}`}>{initials(name)}</span>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [settings, setSettings] = useState<Settings>({
    checkInStart: "08:30", checkInEnd: "10:00", checkOutStart: "17:00", checkOutEnd: "20:00", timezone: "Asia/Kolkata"
  });
  const [today, setToday] = useState("");
  const [todayPresent, setTodayPresent] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const isManager = user?.role === "admin" || user?.role === "hr";

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [employeeData, attendanceData, settingsData] = await Promise.all([
        request<{ employees: Employee[] }>("/api/employees"),
        request<{ records: Attendance[]; today: string; activeEmployees: number; todayPresent: number }>("/api/attendance"),
        request<{ settings: Settings }>("/api/settings")
      ]);
      setEmployees(employeeData.employees);
      setRecords(attendanceData.records);
      setToday(attendanceData.today);
      setTodayPresent(attendanceData.todayPresent);
      setActiveEmployees(attendanceData.activeEmployees);
      setSettings(settingsData.settings);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load workspace.");
    } finally {
      setLoading(false);
    }
  }, [notify, user]);

  useEffect(() => {
    request<{ user: User }>("/api/auth/me")
      .then(({ user: current }) => setUser(current))
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [refresh, user]);

  const filteredEmployees = useMemo(() => employees.filter((employee) =>
    [employee.name, employee.employeeId, employee.department, employee.designation, employee.email]
      .some((value) => value?.toLowerCase().includes(search.toLowerCase()))
  ), [employees, search]);

  const todayRecords = records.filter((record) => record.dateKey === today && record.checkIn);
  const checkedInToday = user?.role === "employee"
    ? records.some((record) => record.dateKey === today && record.checkIn)
    : todayPresent;
  const myToday = records.find((record) => record.dateKey === today);
  const presentPercent = activeEmployees ? Math.round((todayPresent / activeEmployees) * 100) : 0;

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      const result = await request<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ employeeId: loginId, password })
      });
      setUser(result.user);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  async function signOut() {
    await request("/api/auth/logout", { method: "POST" });
    setUser(null);
    setEmployees([]);
    setRecords([]);
  }

  async function markAttendance(action: "check-in" | "check-out") {
    try {
      await request("/api/attendance", { method: "POST", body: JSON.stringify({ action }) });
      notify(action === "check-in" ? "You're checked in. Have a great day!" : "You're checked out. See you tomorrow!");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Attendance could not be updated.");
    }
  }

  async function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = { ...form };
      if (editingId && !payload.password) delete (payload as Partial<EmployeeForm>).password;
      const result = await request<{ employee: Employee }>(
        editingId ? `/api/employees/${editingId}` : "/api/employees",
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) }
      );
      setEmployees((previous) => editingId
        ? previous.map((employee) => employee._id === editingId ? result.employee : employee)
        : [...previous, result.employee].sort((a, b) => a.name.localeCompare(b.name)));
      setFormOpen(false);
      setEditingId("");
      setForm(emptyForm);
      notify(editingId ? "Employee details updated." : "Employee added successfully.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Employee could not be saved.");
    }
  }

  function editEmployee(employee: Employee) {
    setEditingId(employee._id);
    setForm({
      employeeId: employee.employeeId, name: employee.name, email: employee.email,
      department: employee.department, designation: employee.designation, phone: employee.phone ?? "",
      joiningDate: employee.joiningDate.slice(0, 10), salary: employee.salary ?? 0,
      role: employee.role, password: ""
    });
    setFormOpen(true);
  }

  async function toggleEmployee(employee: Employee) {
    const status = employee.status === "active" ? "inactive" : "active";
    try {
      await request(`/api/employees/${employee._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setEmployees((previous) => previous.map((item) => item._id === employee._id ? { ...item, status } : item));
      notify(`${employee.name} is now ${status}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Employee status could not be updated.");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await request<{ settings: Settings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(settings)
      });
      setSettings(result.settings);
      notify("Attendance windows saved.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Settings could not be saved.");
    }
  }

  if (booting) return <main className="loading-screen"><div className="brand-mark"><Fingerprint size={21} /></div><span>Loading workspace...</span></main>;
  if (!user) {
    return (
      <main className="login-page">
        <section className="login-aside">
          <div className="brand"><span className="brand-mark"><Fingerprint size={21} /></span><span>shiftly<span className="brand-period">.</span></span></div>
          <div className="login-story">
            <span className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> PEOPLE, IN SYNC</span>
            <h1>A better way to<br />show up <em>every day.</em></h1>
            <p>One calm, clear place to manage your people, keep track of time, and make work flow.</p>
            <div className="login-stats">
              <div><strong>01</strong><span>One simple workspace</span></div>
              <div><strong>∞</strong><span>Room to do your best work</span></div>
            </div>
          </div>
          <div className="aside-footer"><span>MADE FOR TEAMS THAT MOVE FORWARD</span><span>© 2025 SHIFTLY</span></div>
          <div className="aside-decoration decoration-one" /><div className="aside-decoration decoration-two" />
        </section>
        <section className="login-main">
          <div className="login-card-wrap">
            <div className="mobile-brand brand"><span className="brand-mark"><Fingerprint size={21} /></span><span>shiftly<span className="brand-period">.</span></span></div>
            <div className="login-heading">
              <div className="login-icon"><ShieldCheck size={22} /></div>
              <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
              <h2>Welcome back</h2>
              <p>Sign in with your employee ID to continue.</p>
            </div>
            <form onSubmit={signIn} className="login-form">
              <label>Employee ID
                <div className="input-wrap"><BriefcaseBusiness size={17} /><input autoComplete="username" autoFocus value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="e.g. EMP001" required /></div>
              </label>
              <label>Password
                <div className="input-wrap"><span className="lock-symbol">••</span><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></div>
              </label>
              {loginError && <div className="form-error">{loginError}</div>}
              <button className="button button-primary login-submit" type="submit">Sign in <ArrowUpRight size={17} /></button>
            </form>
            <div className="login-security"><ShieldCheck size={15} /> Your account is secured and encrypted</div>
            <p className="login-help">Having trouble signing in? <span>Contact your HR team</span></p>
          </div>
          <span className="login-copyright">© 2025 Shiftly · Built for better workdays</span>
        </section>
      </main>
    );
  }

  const navItems: { id: Page; label: string; icon: typeof LayoutDashboard; managersOnly?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "employees", label: "People", icon: Users, managersOnly: true },
    { id: "attendance", label: "Attendance", icon: CalendarDays },
    { id: "settings", label: "Work hours", icon: Settings2, managersOnly: true }
  ];
  const pageTitle = { overview: "Good morning", employees: "People", attendance: "Attendance", settings: "Work hours" }[page];

  return (
    <AppShell>
      <div className="app-layout">
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
          <div className="sidebar-brand brand"><span className="brand-mark"><Fingerprint size={21} /></span><span>shiftly<span className="brand-period">.</span></span></div>
          <div className="workspace-picker"><span className="workspace-logo">S</span><span><strong>Studio North</strong><small>Workspace</small></span><ChevronDown size={15} /></div>
          <span className="nav-label">WORKSPACE</span>
          <nav className="main-nav">
            {navItems.filter((item) => !item.managersOnly || isManager).map((item) => {
              const Icon = item.icon;
              return <button key={item.id} className={`nav-link ${page === item.id ? "nav-active" : ""}`} onClick={() => { setPage(item.id); setMobileNav(false); }}><Icon size={18} /><span>{item.label}</span>{item.id === "attendance" && <span className="nav-count">{records.length}</span>}</button>;
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="help-card"><span className="help-spark">✳</span><strong>Need a hand?</strong><p>Your people team is just a message away.</p><button onClick={() => notify("Ask your workspace administrator for help.")}>Get support <ArrowUpRight size={14} /></button></div>
            <button className="profile-row" onClick={signOut}><Avatar name={user.name} color="lavender" /><span className="profile-copy"><strong>{user.name}</strong><small>{user.role === "admin" ? "Administrator" : user.role === "hr" ? "People & culture" : user.employeeId}</small></span><LogOut size={16} /></button>
          </div>
        </aside>

        <main className="main-panel">
          <header className="topbar">
            <button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{page === "overview" ? "Overview" : pageTitle}</strong></div>
            <div className="topbar-actions"><span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span><button className="icon-button notification-button" onClick={() => notify("You're all caught up.")} aria-label="Notifications"><Bell size={18} /><i /></button><div className="topbar-divider" /><button className="topbar-user" onClick={signOut}><Avatar name={user.name} color="lavender" /><span>{user.name.split(" ")[0]}</span><ChevronDown size={14} /></button></div>
          </header>
          <div className="content-area" aria-busy={loading}>
            <div className="page-intro">
              <div><div className="eyebrow page-kicker"><span className="eyebrow-dot" /> YOUR TEAM, AT A GLANCE</div><h1>{page === "overview" ? <>Good morning, {user.name.split(" ")[0]} <span className="wave">✳</span></> : pageTitle}</h1><p>{page === "overview" ? "Here's what's happening across your workspace today." : page === "employees" ? "The people who make your work possible." : page === "attendance" ? "A clear picture of who's here and when." : "Set the hours your team can check in and out."}</p></div>
              {page === "employees" && isManager && <button className="button button-primary" onClick={() => { setEditingId(""); setForm(emptyForm); setFormOpen(true); }}><Plus size={17} /> Add employee</button>}
              {page === "attendance" && <button className="button button-secondary" onClick={() => window.print()}><Download size={16} /> Export report</button>}
            </div>

            {page === "overview" && <>
              {user.role === "employee" ? (
                <section className="employee-welcome-grid">
                  <div className="welcome-card">
                    <div className="welcome-content"><span className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> YOUR DAY, YOUR PACE</span><h2>Make today<br />a good one.</h2><p>Your attendance, all in one place. You&apos;re doing great.</p></div>
                    <div className="welcome-clock"><div className="clock-ring"><Clock3 size={35} /><span>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())}</span></div><span>LOCAL TIME</span></div>
                  </div>
                  <div className="attendance-action-card"><div className="card-title-row"><span className="card-icon mint-icon"><Fingerprint size={18} /></span><span className="today-pill"><i /> TODAY</span></div><h3>{myToday?.checkIn ? myToday.checkOut ? "Day complete" : "You're checked in" : "Ready to begin?"}</h3><p>{myToday?.checkIn ? myToday.checkOut ? "Your attendance for today is recorded." : `Checked in at ${clock(myToday.checkIn)}. Have a productive day!` : `Check-in window · ${settings.checkInStart} – ${settings.checkInEnd}`}</p>
                    {!myToday?.checkIn ? <button className="button button-primary full-button" onClick={() => markAttendance("check-in")}><ArrowDownLeft size={17} /> Check in</button> : !myToday.checkOut ? <button className="button button-dark full-button" onClick={() => markAttendance("check-out")}><ArrowUpRight size={17} /> Check out</button> : <div className="complete-note"><Check size={16} /> Attendance complete for today</div>}
                  </div>
                </section>
              ) : (
                <>
                  <section className="hero-card">
                    <div className="hero-copy"><span className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> THE DAILY BRIEF</span><h2>Good work starts<br />with good people.</h2><p>Your team&apos;s doing wonderful things. Here&apos;s the pulse of your workspace.</p><button className="hero-link" onClick={() => setPage("attendance")}>Explore today&apos;s attendance <ArrowUpRight size={16} /></button></div>
                    <div className="hero-graphic"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><span className="graphic-dot dot-a" /><span className="graphic-dot dot-b" /><span className="graphic-dot dot-c" /><div className="graphic-center"><Fingerprint size={37} /></div><div className="graphic-caption"><span className="graphic-pulse" /> PEOPLE FIRST · ALWAYS</div></div>
                    <div className="hero-corner">S<span>.</span></div>
                  </section>
                  <section className="stats-grid">
                    <div className="stat-card"><div className="stat-head"><span>TEAM MEMBERS</span><span className="stat-icon lilac-icon"><Users size={17} /></span></div><div className="stat-value">{activeEmployees}<span className="stat-unit"> people</span></div><div className="stat-footer"><span className="stat-note">Across your workspace</span><span className="stat-trend">ACTIVE</span></div></div>
                    <div className="stat-card"><div className="stat-head"><span>HERE TODAY</span><span className="stat-icon mint-icon"><Fingerprint size={17} /></span></div><div className="stat-value">{checkedInToday}<span className="stat-unit"> / {activeEmployees}</span></div><div className="stat-footer"><span className="stat-note">Attendance recorded</span><span className="stat-trend">{presentPercent}%</span></div><div className="stat-progress"><span style={{ width: `${presentPercent}%` }} /></div></div>
                    <div className="stat-card"><div className="stat-head"><span>CHECK-IN WINDOW</span><span className="stat-icon peach-icon"><Clock3 size={17} /></span></div><div className="stat-value stat-time">{settings.checkInStart}<span className="stat-unit"> — {settings.checkInEnd}</span></div><div className="stat-footer"><span className="stat-note">Team local time</span><span className="stat-zone">{settings.timezone}</span></div></div>
                  </section>
                  <section className="dashboard-grid">
                    <div className="panel attendance-panel"><div className="panel-heading"><div><h3>Today at a glance</h3><p>A little snapshot of your team&apos;s day.</p></div><button className="text-link" onClick={() => setPage("attendance")}>Full report <ArrowUpRight size={14} /></button></div>
                      <div className="attendance-list">{todayRecords.slice(0, 5).map((record, index) => { const person = employeeOf(record); return <div className="attendance-row" key={record._id}><Avatar name={person?.name ?? "Employee"} color={["mint", "lavender", "peach", "blue", "yellow"][index % 5]} /><div className="person-info"><strong>{person?.name ?? "Employee"}</strong><span>{person?.department ?? "Team member"}</span></div><div className="attendance-time"><span>IN</span><strong>{clock(record.checkIn)}</strong></div><div className="attendance-time"><span>OUT</span><strong>{clock(record.checkOut)}</strong></div><span className={`status-badge ${record.status === "late" ? "status-late" : "status-present"}`}><i />{record.status === "late" ? "Late" : "On time"}</span></div>; })}{todayRecords.length === 0 && <div className="empty-state"><span className="empty-icon"><CalendarDays size={20} /></span><strong>It&apos;s a fresh start</strong><span>Attendance will show here as your team checks in.</span></div>}</div>
                    </div>
                    <div className="panel people-panel"><div className="panel-heading"><div><h3>Your people</h3><p>A team is a beautiful thing.</p></div><button className="mini-arrow" onClick={() => setPage("employees")}><ArrowUpRight size={16} /></button></div><div className="people-summary"><div className="avatar-stack">{employees.filter((person) => person.status === "active").slice(0, 4).map((person, index) => <Avatar key={person._id} name={person.name} color={["mint", "lavender", "peach", "blue"][index % 4]} />)}</div><span><strong>{activeEmployees}</strong> kind humans</span></div><div className="department-list">{Object.entries(employees.reduce<Record<string, number>>((group, person) => { if (person.status === "active") group[person.department] = (group[person.department] ?? 0) + 1; return group; }, {})).slice(0, 4).map(([department, count]) => <div key={department}><span>{department}</span><strong>{count.toString().padStart(2, "0")}</strong></div>)}{employees.length === 0 && <div className="department-empty">Your team is ready to grow.</div>}</div><button className="people-link" onClick={() => setPage("employees")}>Meet the whole team <ArrowUpRight size={15} /></button></div>
                  </section>
                </>
              )}
              <section className="bottom-note"><span className="note-spark">✳</span><span><strong>People make the place.</strong> Here&apos;s to another day of doing good things together.</span><span className="bottom-note-date">{humanDate(new Date().toISOString())}</span></section>
            </>}

            {page === "employees" && isManager && <section className="panel table-panel"><div className="table-toolbar"><div className="table-count"><strong>{employees.length}</strong> people <span className="active-count"><i /> {employees.filter((person) => person.status === "active").length} active</span></div><label className="search-box"><Search size={16} /><input placeholder="Search people..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label></div>
              <div className="table-scroll"><table><thead><tr><th>PERSON</th><th>ROLE</th><th>DEPARTMENT</th><th>EMPLOYEE ID</th><th>JOINED</th><th>STATUS</th><th /></tr></thead><tbody>{filteredEmployees.map((employee, index) => <tr key={employee._id}><td><div className="table-person"><Avatar name={employee.name} color={["mint", "lavender", "peach", "blue", "yellow"][index % 5]} /><span><strong>{employee.name}</strong><small>{employee.email}</small></span></div></td><td>{employee.designation}</td><td><span className="department-tag">{employee.department}</span></td><td className="id-cell">{employee.employeeId}</td><td>{humanDate(employee.joiningDate)}</td><td><span className={`employee-status ${employee.status}`}><i />{employee.status}</span></td><td><div className="row-actions">{(user.role === "admin" || employee.role !== "admin") && <button onClick={() => editEmployee(employee)}>Edit</button>}{user.role === "admin" && <button onClick={() => toggleEmployee(employee)}>{employee.status === "active" ? "Deactivate" : "Activate"}</button>}</div></td></tr>)}</tbody></table>
                {filteredEmployees.length === 0 && <div className="empty-state"><span className="empty-icon"><Users size={20} /></span><strong>{search ? "No people found" : "Your team starts here"}</strong><span>{search ? "Try another name, role or employee ID." : "Add your first employee to get things moving."}</span></div>}
              </div><div className="table-footer"><span>Showing {filteredEmployees.length} of {employees.length} team members</span><span>Last updated just now</span></div>
            </section>}

            {page === "attendance" && <section className="panel table-panel attendance-report">            <div className="report-summary"><div><span className="report-label">TODAY&apos;S ATTENDANCE</span><strong>{user.role === "employee" ? (myToday?.checkIn ? "1" : "0") : todayPresent}<small> / {user.role === "employee" ? "1" : activeEmployees} checked in</small></strong></div><div className="report-progress"><div><span>Attendance rate</span><strong>{user.role === "employee" ? (myToday?.checkIn ? "100%" : "0%") : `${presentPercent}%`}</strong></div><div className="progress-track"><span style={{ width: `${user.role === "employee" ? (myToday?.checkIn ? "100%" : "0%") : `${presentPercent}%`}` }} /></div></div></div>
              <div className="table-toolbar"><div className="table-count"><strong>Recent records</strong> <span className="active-count">{records.length} entries</span></div>{isManager && <label className="search-box"><Search size={16} /><input placeholder="Search people..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>}</div>
              <div className="table-scroll"><table><thead><tr><th>PERSON</th><th>DATE</th><th>CHECK IN</th><th>CHECK OUT</th><th>HOURS</th><th>STATUS</th></tr></thead><tbody>{records.filter((record) => { const person = employeeOf(record); return user.role === "employee" || !search || person?.name.toLowerCase().includes(search.toLowerCase()) || person?.employeeId.toLowerCase().includes(search.toLowerCase()); }).map((record, index) => { const person = employeeOf(record); const duration = record.checkIn && record.checkOut ? Math.max(0, (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / 3600000) : null; return <tr key={record._id}><td><div className="table-person"><Avatar name={person?.name ?? user.name} color={["mint", "lavender", "peach", "blue", "yellow"][index % 5]} /><span><strong>{person?.name ?? user.name}</strong><small>{person?.employeeId ?? user.employeeId}</small></span></div></td><td>{humanDate(record.dateKey)}</td><td className="time-cell">{clock(record.checkIn)}</td><td className="time-cell">{clock(record.checkOut)}</td><td>{duration === null ? <span className="muted-cell">In progress</span> : `${Math.floor(duration)}h ${Math.round((duration % 1) * 60)}m`}</td><td><span className={`status-badge ${record.status === "late" ? "status-late" : "status-present"}`}><i />{record.status === "late" ? "Late" : "Present"}</span></td></tr>; })}</tbody></table>{records.length === 0 && <div className="empty-state"><span className="empty-icon"><Clock3 size={20} /></span><strong>No attendance records yet</strong><span>Records appear after employees check in.</span></div>}</div><div className="table-footer"><span>Showing up to 100 recent records</span><span>Workspace timezone · {settings.timezone}</span></div>
            </section>}

            {page === "settings" && isManager && <section className="settings-grid"><div className="panel settings-panel"><div className="settings-heading"><span className="settings-icon"><Clock3 size={19} /></span><div><h3>Attendance windows</h3><p>Choose when your team can record their day.</p></div></div><form onSubmit={saveSettings} className="settings-form"><div className="window-group"><div className="window-label"><span className="window-symbol check-in-symbol"><ArrowDownLeft size={15} /></span><span><strong>Check-in</strong><small>When the workday begins</small></span></div><div className="time-inputs"><label>START<input type="time" value={settings.checkInStart} onChange={(event) => setSettings({ ...settings, checkInStart: event.target.value })} required /></label><span>to</span><label>END<input type="time" value={settings.checkInEnd} onChange={(event) => setSettings({ ...settings, checkInEnd: event.target.value })} required /></label></div></div><div className="window-group"><div className="window-label"><span className="window-symbol check-out-symbol"><ArrowUpRight size={15} /></span><span><strong>Check-out</strong><small>When the workday wraps up</small></span></div><div className="time-inputs"><label>START<input type="time" value={settings.checkOutStart} onChange={(event) => setSettings({ ...settings, checkOutStart: event.target.value })} required /></label><span>to</span><label>END<input type="time" value={settings.checkOutEnd} onChange={(event) => setSettings({ ...settings, checkOutEnd: event.target.value })} required /></label></div></div><label className="timezone-field">WORKSPACE TIMEZONE<input value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} placeholder="Asia/Kolkata" required /></label><div className="settings-tip"><span>✳</span><p>Team members can only check in or out within these windows. Set the timezone to match where your team works.</p></div><button className="button button-primary settings-save" type="submit"><Check size={16} /> Save work hours</button></form></div><div className="settings-side"><div className="settings-side-art"><div className="settings-art-orbit" /><span className="settings-art-star">✳</span><div className="settings-art-clock"><Clock3 size={28} /></div></div><h3>A little structure<br />goes a long way.</h3><p>Clear attendance hours help everyone build a better rhythm — without getting in the way of great work.</p><div className="side-window"><span><i /> CURRENT CHECK-IN WINDOW</span><strong>{settings.checkInStart} <em>—</em> {settings.checkInEnd}</strong><small>{settings.timezone}</small></div></div></section>}
          </div>
          <footer className="app-footer"><span>SHIFTLY <b>·</b> PEOPLE, IN SYNC</span><span>MADE WITH CARE <span className="footer-heart">♥</span></span></footer>
        </main>
        {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      </div>
      {formOpen && <div className="modal-backdrop" onClick={() => setFormOpen(false)}><section className="employee-modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">GROW YOUR TEAM</span><h2>{editingId ? "Edit employee" : "Add someone new"}</h2><p>Good things happen when the right people come together.</p></div><button className="icon-button" onClick={() => setFormOpen(false)} aria-label="Close"><X size={19} /></button></div><form className="employee-form" onSubmit={saveEmployee}><div className="form-grid"><label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Alex Morgan" required /></label><label>Employee ID<input value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} placeholder="EMP001" required /></label><label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="alex@company.com" required /></label><label>Phone number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" /></label><label>Department<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Design" required /></label><label>Designation<input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} placeholder="Product designer" required /></label><label>Joining date<input type="date" value={form.joiningDate} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} required /></label><label>Annual salary<input type="number" min="0" value={form.salary} onChange={(event) => setForm({ ...form, salary: Number(event.target.value) })} placeholder="0" /></label><label>Access role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}><option value="employee">Employee</option><option value="hr">HR</option>{user.role === "admin" && <option value="admin">Admin</option>}</select></label><label>{editingId ? "New password (optional)" : "Temporary password"}<input type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingId ? "Leave blank to keep current" : "At least 8 characters"} required={!editingId} /></label></div><div className="modal-actions"><span>Employee can sign in using their ID and password.</span><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button className="button button-primary" type="submit">{editingId ? "Save changes" : "Add employee"} <ArrowUpRight size={16} /></button></div></form></section></div>}
      {toast && <div className="toast"><span><Check size={15} /></span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </AppShell>
  );
}

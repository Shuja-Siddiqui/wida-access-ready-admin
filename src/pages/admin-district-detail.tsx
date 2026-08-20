import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import {
  Building2, Users, ChevronLeft, MapPin, Hash,
  GraduationCap, School, UserCog, Search, X, Mail, BookOpen,
  Flame, Star, TrendingUp, Calendar,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Student {
  id: string;
  name: string;
  gradeBand: string | null;
  stateAssessment: string | null;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  role: string;
  students: Student[];
}

interface SchoolData {
  id: string;
  name: string;
  state: string | null;
  schoolCode: string | null;
  teacherCount: number;
  studentCount: number;
  teachers: Teacher[];
}

interface District {
  id: string;
  name: string;
  state: string | null;
  districtCode: string | null;
  schoolCount: number;
}

interface DistrictDetailResponse {
  district: District;
  schools: SchoolData[];
}

type Tab = "students" | "teachers";

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color, background: bg }}>
      {children}
    </span>
  );
}

function TeacherModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const initials = teacher.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-border shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#059669] text-sm font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">{teacher.name}</h2>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />{teacher.email}
              </span>
              <Badge color="#059669" bg="#D1FAE5">
                {teacher.role.charAt(0).toUpperCase() + teacher.role.slice(1)}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Students assigned */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/30 shrink-0">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {teacher.students.length} student{teacher.students.length !== 1 ? "s" : ""} assigned
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {teacher.students.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
              <GraduationCap className="w-7 h-7" />
              <p className="text-sm">No students assigned yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grade</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teacher.students.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#6366F1] text-xs font-semibold shrink-0">
                          {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-foreground">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">{student.gradeBand ?? "—"}</td>
                    <td className="px-5 py-2.5">
                      {student.stateAssessment
                        ? <Badge color="#6366F1" bg="#EEF2FF">{student.stateAssessment}</Badge>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Domain colour map ────────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  listening: "#FF4D8D",
  speaking:  "#059669",
  reading:   "#EA580C",
  writing:   "#9333EA",
};

interface StudentDetailData {
  student: {
    id: string; name: string; gradeBand: string; stateAssessment: string;
    currentStreak: number; longestStreak: number; totalXp: number;
    lastSessionDate: string | null; createdAt: string; teacherName: string | null;
  };
  levels: { domain: string; currentLevel: string; exitThreshold: string; atExit: boolean }[];
  sessions: { domain: string; levelEnd: string; scorePct: number; createdAt: string }[];
}

function buildChartData(sessions: StudentDetailData["sessions"]) {
  const current: Record<string, number> = {};
  return sessions.map((s) => {
    current[s.domain] = Number(s.levelEnd);
    return {
      date: new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...Object.fromEntries(Object.entries(current).map(([k, v]) => [k, v])),
    };
  });
}

function StudentModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-student-detail", studentId],
    queryFn: () => apiRequest<StudentDetailData>(`/api/admin/students/${studentId}`),
    staleTime: 60_000,
  });

  const student = data?.student;
  const levels  = data?.levels ?? [];
  const chartData = buildChartData(data?.sessions ?? []);
  const hasSessions = chartData.length > 0;
  const domainsInChart = ["listening", "speaking", "reading", "writing"].filter(
    (d) => (data?.sessions ?? []).some((s) => s.domain === d),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-border shrink-0">
          {student ? (
            <>
              <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#6366F1] text-sm font-bold shrink-0">
                {student.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground">{student.name}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge color="#6366F1" bg="#EEF2FF">{student.stateAssessment}</Badge>
                  <Badge color="#7C3AED" bg="#EDE9FE">{student.gradeBand}</Badge>
                  {student.teacherName && (
                    <span className="text-xs text-muted-foreground">Teacher: {student.teacherName}</span>
                  )}
                </div>
              </div>
              {/* Quick stats */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <p className="text-lg font-bold text-foreground leading-none">{student.currentStreak}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Streak</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500" />
                    <p className="text-lg font-bold text-foreground leading-none">{student.totalXp}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">XP</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 h-10 bg-muted rounded animate-pulse" />
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">Could not load student details.</div>
          ) : student ? (
            <div className="p-6 space-y-6">

              {/* Meta row */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {new Date(student.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {student.lastSessionDate && (
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Last active {new Date(student.lastSessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  Longest streak: {student.longestStreak} days
                </span>
              </div>

              {/* Domain score cards */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Domain Scores</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["listening", "speaking", "reading", "writing"] as const).map((domain) => {
                    const lvl = levels.find((l) => l.domain === domain);
                    if (!lvl) return (
                      <div key={domain} className="bg-muted/30 border border-border rounded-lg p-3 animate-pulse h-20" />
                    );
                    const current   = Number(lvl.currentLevel);
                    const threshold = Number(lvl.exitThreshold);
                    const pct       = Math.min(100, Math.round((current / threshold) * 100));
                    const color     = DOMAIN_COLORS[domain] ?? "#6366F1";
                    return (
                      <div key={domain} className="bg-card border border-border rounded-lg p-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold capitalize text-foreground">{domain}</span>
                          <div className="flex items-center gap-1.5">
                            {lvl.atExit && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}18` }}>
                                ✓ EXIT
                              </span>
                            )}
                            <span className="text-sm font-bold text-foreground">{current.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">/ {threshold.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 text-right">{pct}% to exit</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress history chart */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Progress History</p>
                {!hasSessions ? (
                  <div className="flex flex-col items-center gap-2 py-10 bg-muted/20 rounded-lg border border-border text-muted-foreground">
                    <TrendingUp className="w-7 h-7" />
                    <p className="text-sm">No sessions recorded yet.</p>
                  </div>
                ) : (
                  <div className="bg-muted/10 border border-border rounded-lg p-3">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        {domainsInChart.map((domain) => (
                          <Line
                            key={domain}
                            type="monotone"
                            dataKey={domain}
                            stroke={DOMAIN_COLORS[domain]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SchoolPanel({ school }: { school: SchoolData }) {
  const [tab, setTab] = useState<Tab>("students");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const principal = school.teachers.find((t) => t.role === "principal");
  const teachers  = school.teachers.filter((t) => t.role !== "principal");
  const students  = school.teachers.flatMap((t) => t.students);

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* School details card */}
      <div className="bg-card border border-border rounded-lg px-5 py-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] text-sm font-semibold shrink-0">
            {school.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{school.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {school.state && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />{school.state}
                </span>
              )}
              {school.schoolCode && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Hash className="w-3 h-3" />{school.schoolCode}
                </span>
              )}
            </div>
            {principal && (
              <div className="flex items-center gap-1.5 mt-2">
                <UserCog className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Principal:</span>
                <span className="text-xs font-medium text-foreground">{principal.name}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{principal.email}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0 text-right">
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{teachers.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Teachers</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{students.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Students</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border">
          {(["students", "teachers"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "students" ? <GraduationCap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              {t === "students" ? "Students" : "Teachers"}
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                tab === t ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {t === "students" ? students.length : teachers.length}
              </span>
            </button>
          ))}
        </div>

        {/* Students table */}
        {tab === "students" && (
          students.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
              <GraduationCap className="w-7 h-7" />
              <p className="text-sm">No students in this school yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grade Band</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assessment</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teacher</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {school.teachers.flatMap((teacher) =>
                    teacher.students.map((student) => (
                      <tr
                        key={student.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#6366F1] text-xs font-semibold shrink-0">
                              {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                            </div>
                            <span className="font-medium text-foreground">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{student.gradeBand ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {student.stateAssessment
                            ? <Badge color="#6366F1" bg="#EEF2FF">{student.stateAssessment}</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{teacher.name}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs text-primary font-medium">View →</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Teachers table */}
        {tab === "teachers" && (
          teachers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
              <Users className="w-7 h-7" />
              <p className="text-sm">No teachers assigned to this school yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Students</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {teachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedTeacher(teacher)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#059669] text-xs font-semibold shrink-0">
                            {teacher.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
                          </div>
                          <span className="font-medium text-foreground">{teacher.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{teacher.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge color="#059669" bg="#D1FAE5">
                          {teacher.role.charAt(0).toUpperCase() + teacher.role.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-foreground">{teacher.students.length}</span>
                        <span className="text-xs text-muted-foreground ml-1">student{teacher.students.length !== 1 ? "s" : ""}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs text-primary font-medium">View →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Teacher detail modal */}
      {selectedTeacher && (
        <TeacherModal teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} />
      )}

      {/* Student detail modal */}
      {selectedStudentId && (
        <StudentModal studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />
      )}
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="flex-1 space-y-4">
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-40" />
          <div className="h-3 bg-muted rounded w-24" />
          <div className="h-3 bg-muted rounded w-48" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse space-y-3">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-px bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-muted" />
            <div className="h-3 bg-muted rounded flex-1" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDistrictDetail() {
  const { districtId } = useParams<{ districtId: string }>();
  const [, navigate] = useLocation();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-district-detail", districtId],
    queryFn: () => apiRequest<DistrictDetailResponse>(`/api/admin/districts/${districtId}`),
    enabled: !!districtId,
  });

  const district = data?.district;
  const schools: SchoolData[]  = data?.schools ?? [];

  // Auto-select first school once data arrives
  useEffect(() => {
    if (schools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(schools[0].id);
    }
  }, [schools.length, selectedSchoolId]);

  const totalTeachers = schools.reduce((a, s) => a + s.teacherCount, 0);
  const totalStudents = schools.reduce((a, s) => a + s.studentCount, 0);

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId) ?? null;

  return (
    <AdminLayout title={isLoading ? "District" : (district?.name ?? "District")}>
      <div className="space-y-5">
        {/* Back link */}
        <button
          onClick={() => navigate("/districts")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All Districts
        </button>

        {isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            Could not load district details.
          </div>
        ) : isLoading ? (
          <div className="flex gap-4">
            <div className="w-56 shrink-0 bg-card border border-border rounded-lg p-3 animate-pulse space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-9 bg-muted rounded-lg" />)}
            </div>
            <SkeletonPanel />
          </div>
        ) : district ? (
          <>
            {/* District header */}
            <div className="bg-card border border-border rounded-lg px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] text-sm font-semibold shrink-0">
                {district.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground">{district.name}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  {district.state && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />{district.state}
                    </span>
                  )}
                  {district.districtCode && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="w-3 h-3" />{district.districtCode}
                    </span>
                  )}
                </div>
              </div>
              {/* Summary stat pills */}
              <div className="flex items-center gap-3 shrink-0">
                {[
                  { icon: School,        label: "Schools",  value: schools.length, color: "#7C3AED", bg: "#EDE9FE" },
                  { icon: Users,         label: "Teachers", value: totalTeachers,  color: "#059669", bg: "#D1FAE5" },
                  { icon: GraduationCap, label: "Students", value: totalStudents,  color: "#6366F1", bg: "#EEF2FF" },
                ].map(({ icon: Icon, label, value, color, bg }) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: bg }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-none">{value}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* School filter sidebar + detail panel */}
            {schools.length === 0 ? (
              <div className="bg-card border border-border rounded-lg py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Building2 className="w-8 h-8" />
                <p className="text-sm font-medium">No schools in this district yet.</p>
              </div>
            ) : (
              <div className="flex gap-4 items-start">
                {/* School list / filter */}
                <div className="w-56 shrink-0 bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-3 pt-3 pb-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter schools…"
                        className="w-full pl-7 pr-3 py-1.5 text-sm rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredSchools.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-muted-foreground text-center">No schools match</p>
                    ) : (
                      filteredSchools.map((school) => (
                        <button
                          key={school.id}
                          onClick={() => setSelectedSchoolId(school.id)}
                          className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-2 ${
                            school.id === selectedSchoolId
                              ? "bg-primary/8 border-l-2 border-primary"
                              : "hover:bg-muted/40 border-l-2 border-transparent"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            school.id === selectedSchoolId ? "bg-primary text-primary-foreground" : "bg-[#EDE9FE] text-[#7C3AED]"
                          }`}>
                            {school.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${
                              school.id === selectedSchoolId ? "text-foreground" : "text-foreground"
                            }`}>
                              {school.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {school.studentCount} student{school.studentCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* School detail panel */}
                {selectedSchool ? (
                  <SchoolPanel key={selectedSchool.id} school={selectedSchool} />
                ) : (
                  <div className="flex-1 bg-card border border-border rounded-lg py-16 flex flex-col items-center gap-2 text-muted-foreground">
                    <School className="w-7 h-7" />
                    <p className="text-sm">Select a school to view details</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

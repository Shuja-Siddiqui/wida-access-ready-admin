import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { Building2, Users, School, BookOpen, CreditCard, UserCheck, Activity } from "lucide-react";

interface AdminStats {
  users: { total: number; byRole: Record<string, number> };
  students: number;
  profiles: number;
  districts: number;
  schools: number;
  activeSubscriptions: number;
}

const STAT_CONFIG = [
  { key: "users",              label: "Total Users",     icon: Users,      color: "#6366F1", bg: "#EEF2FF" },
  { key: "activeSubscriptions",label: "Active Subs",     icon: CreditCard, color: "#0EA5E9", bg: "#E0F2FE" },
  { key: "districts",          label: "Districts",       icon: Building2,  color: "#8B5CF6", bg: "#EDE9FE" },
  { key: "schools",            label: "Schools",         icon: School,     color: "#F59E0B", bg: "#FEF3C7" },
  { key: "students",           label: "Students",        icon: BookOpen,   color: "#10B981", bg: "#D1FAE5" },
  { key: "profiles",           label: "Educators",       icon: UserCheck,  color: "#EC4899", bg: "#FCE7F3" },
] as const;

const ROLE_COLORS: Record<string, string> = {
  student:        "#6366F1",
  teacher:        "#10B981",
  principal:      "#8B5CF6",
  parent:         "#F59E0B",
  district_admin: "#0EA5E9",
  super_admin:    "#EC4899",
};

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: React.ElementType; color: string; bg: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} strokeWidth={2} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-muted mb-3" />
      <div className="h-7 w-16 bg-muted rounded mb-1.5" />
      <div className="h-4 w-24 bg-muted rounded" />
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => apiRequest("/api/admin/stats"),
  });

  const getValue = (key: string) => {
    if (!data) return 0;
    if (key === "users") return data.users.total;
    return (data as unknown as Record<string, number>)[key] ?? 0;
  };

  return (
    <AdminLayout title="Overview">
      <div className="space-y-6">

        {/* Stat grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : STAT_CONFIG.map((s) => (
                <StatCard key={s.key} label={s.label} value={getValue(s.key)} icon={s.icon} color={s.color} bg={s.bg} />
              ))
          }
        </div>

        {/* Role breakdown */}
        {!isLoading && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Users by Role</h3>
              </div>
              <div className="space-y-3.5">
                {Object.entries(data.users.byRole)
                  .sort(([, a], [, b]) => b - a)
                  .map(([role, count]) => {
                    const pct = data.users.total > 0 ? (count / data.users.total) * 100 : 0;
                    const color = ROLE_COLORS[role] ?? "#94A3B8";
                    return (
                      <div key={role}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-sm text-foreground capitalize">{role.replace(/_/g, " ")}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular-nums">{count.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-5">Platform Summary</h3>
              <div className="space-y-1">
                {[
                  { label: "Total registered users", value: data.users.total },
                  { label: "Active subscriptions",   value: data.activeSubscriptions },
                  { label: "School districts",        value: data.districts },
                  { label: "Schools",                 value: data.schools },
                  { label: "Student accounts",        value: data.students },
                  { label: "Educator accounts",       value: data.profiles },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

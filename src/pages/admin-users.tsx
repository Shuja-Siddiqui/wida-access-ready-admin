import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Users, ChevronLeft, ChevronRight, Search, CheckCircle, XCircle } from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  email_verified: boolean;
  created_at: string;
}

interface UsersResponse {
  users: AdminUser[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

const ROLE_STYLE: Record<string, { color: string; bg: string }> = {
  student:        { color: "#6366F1", bg: "#EEF2FF" },
  teacher:        { color: "#059669", bg: "#D1FAE5" },
  principal:      { color: "#7C3AED", bg: "#EDE9FE" },
  parent:         { color: "#D97706", bg: "#FEF3C7" },
  district_admin: { color: "#0284C7", bg: "#E0F2FE" },
  super_admin:    { color: "#DB2777", bg: "#FCE7F3" },
};

const ROLES = ["", "student", "teacher", "principal", "parent", "district_admin", "super_admin"];

function RolePill({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? { color: "#64748B", bg: "#F1F5F9" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, background: s.bg }}
    >
      {role.replace(/_/g, " ")}
    </span>
  );
}

function Initials({ name, role }: { name: string; role: string }) {
  const s = ROLE_STYLE[role] ?? { color: "#64748B", bg: "#F1F5F9" };
  const i = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
      style={{ color: s.color, background: s.bg }}
    >
      {i || "?"}
    </div>
  );
}

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
  }
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (role) params.set("role", role);
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["admin-users", page, role, debouncedSearch],
    queryFn: () => apiRequest(`/api/admin/users?${params}`),
  });

  const pagination = data?.pagination;

  return (
    <AdminLayout title="Users">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search users…"
              className="pl-8 h-8 text-sm rounded-md"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ROLES.map((r) => (
              <button
                key={r || "all"}
                onClick={() => { setRole(r); setPage(1); }}
                className="rounded-md px-2.5 py-1 text-xs font-medium border transition-all"
                style={role === r
                  ? { background: "hsl(243,75%,59%)", color: "white", borderColor: "transparent" }
                  : { background: "white", color: "#64748B", borderColor: "#E2E8F0" }
                }
              >
                {r ? r.replace(/_/g, " ") : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Head */}
          <div className="grid grid-cols-[2fr_2fr_1fr_80px_90px] gap-4 px-5 py-2.5 bg-muted/40 border-b border-border">
            {["Name", "Email", "Role", "Verified", "Joined"].map((h) => (
              <p key={h} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_2fr_1fr_80px_90px] gap-4 px-5 py-3 border-b border-border last:border-0 animate-pulse">
                <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-muted shrink-0" /><div className="h-3.5 bg-muted rounded w-28" /></div>
                <div className="flex items-center"><div className="h-3 bg-muted rounded w-40" /></div>
                <div className="flex items-center"><div className="h-5 bg-muted rounded-full w-16" /></div>
                <div className="flex items-center"><div className="h-3 bg-muted rounded w-8" /></div>
                <div className="flex items-center"><div className="h-3 bg-muted rounded w-14" /></div>
              </div>
            ))
          ) : !data?.users?.length ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <Users className="w-8 h-8" />
              <p className="text-sm font-medium">No users found</p>
            </div>
          ) : (
            data.users.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[2fr_2fr_1fr_80px_90px] gap-4 items-center px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Initials name={u.name} role={u.role} />
                  <span className="text-sm font-medium text-foreground truncate">{u.name}</span>
                </div>
                <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                <RolePill role={u.role} />
                <div className="flex items-center gap-1">
                  {u.email_verified
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-muted-foreground/40" />
                  }
                </div>
                <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total.toLocaleString()} users
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-foreground px-1">{page} / {pagination.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

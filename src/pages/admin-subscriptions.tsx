import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { CreditCard, TrendingUp, CheckCircle } from "lucide-react";

interface Subscription {
  subscription_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  status?: string | null;
  quantity?: number | null;
  unit_amount?: number | null;
  currency?: string | null;
  created?: number | null;
}

interface SubscriptionsResponse { subscriptions: Subscription[] }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: "Active",     color: "#059669", bg: "#D1FAE5" },
  trialing:   { label: "Trial",      color: "#6366F1", bg: "#EEF2FF" },
  past_due:   { label: "Past due",   color: "#D97706", bg: "#FEF3C7" },
  canceled:   { label: "Canceled",   color: "#94A3B8", bg: "#F1F5F9" },
  incomplete: { label: "Incomplete", color: "#F59E0B", bg: "#FEF3C7" },
};

function fmt(cents?: number | null, currency?: string | null) {
  if (!cents) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency ?? "usd").toUpperCase(), minimumFractionDigits: 0 }).format(cents / 100);
}

export default function AdminSubscriptions() {
  const { data, isLoading } = useQuery<SubscriptionsResponse>({
    queryKey: ["admin-subscriptions"],
    queryFn: () => apiRequest("/api/admin/subscriptions"),
  });

  const subs = data?.subscriptions ?? [];
  const activeCount = subs.filter((s) => s.status === "active").length;
  const mrr = subs.filter((s) => s.status === "active").reduce((a, s) => a + (s.unit_amount ?? 0) * (s.quantity ?? 1), 0);

  const cards = [
    { label: "Total",   value: subs.length.toString(),      icon: CreditCard,    color: "#6366F1", bg: "#EEF2FF" },
    { label: "Active",  value: activeCount.toString(),       icon: CheckCircle,   color: "#059669", bg: "#D1FAE5" },
    { label: "MRR",     value: fmt(mrr, "usd"),              icon: TrendingUp,    color: "#0EA5E9", bg: "#E0F2FE" },
  ];

  return (
    <AdminLayout title="Subscriptions">
      <div className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {cards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-lg px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} strokeWidth={2} />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_100px_80px_90px_90px] gap-4 px-5 py-2.5 bg-muted/40 border-b border-border">
            {["Customer", "Plan", "Monthly", "Seats", "Status", "Created"].map((h) => (
              <p key={h} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_100px_80px_90px_90px] gap-4 px-5 py-3.5 border-b border-border last:border-0 animate-pulse">
                <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-muted shrink-0" /><div className="space-y-1.5"><div className="h-3.5 bg-muted rounded w-24" /><div className="h-3 bg-muted rounded w-32" /></div></div>
                {Array.from({ length: 5 }).map((_, j) => <div key={j} className="flex items-center"><div className="h-3 bg-muted rounded w-16" /></div>)}
              </div>
            ))
          ) : !subs.length ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <CreditCard className="w-8 h-8" />
              <p className="text-sm font-medium">No subscriptions yet</p>
            </div>
          ) : (
            subs.map((s) => {
              const st = STATUS[s.status ?? ""] ?? STATUS["canceled"];
              const initials = (s.customer_name ?? "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={s.subscription_id} className="grid grid-cols-[2fr_1fr_100px_80px_90px_90px] gap-4 items-center px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#6366F1] text-xs font-semibold flex items-center justify-center shrink-0">{initials}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.customer_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.customer_email ?? "—"}</p>
                    </div>
                  </div>
                  <span className="text-sm text-foreground capitalize">{s.plan_id ?? s.plan_name ?? "—"}</span>
                  <span className="text-sm font-medium text-foreground">{fmt((s.unit_amount ?? 0) * (s.quantity ?? 1), s.currency)}</span>
                  <span className="text-sm text-foreground">{s.quantity ?? 1}</span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                  <span className="text-xs text-muted-foreground">{s.created ? new Date(s.created * 1000).toLocaleDateString() : "—"}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

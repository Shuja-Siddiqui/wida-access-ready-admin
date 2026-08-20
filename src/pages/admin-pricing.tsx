import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Info, Check, Loader2, Users, User } from "lucide-react";

interface Plan { planId: string; name: string; priceCents: number; }
interface PlanEditor { planId: string; name: string; currentCents: number; newDollars: string; changed: boolean; }

const PLAN_META: Record<string, { icon: React.ElementType; description: string; color: string; bg: string }> = {
  solo:         { icon: User,  description: "Individual student plan, billed monthly per account.", color: "#6366F1", bg: "#EEF2FF" },
  organization: { icon: Users, description: "School/district plan, billed monthly per seat.",      color: "#0EA5E9", bg: "#E0F2FE" },
};

export default function AdminPricing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["billing-plans"],
    queryFn: () => apiRequest("/api/billing/plans"),
  });

  const updateMut = useMutation({
    mutationFn: (body: { planId: string; priceCents: number }) =>
      apiRequest("/api/admin/pricing", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billing-plans"] }); },
  });

  const [editors, setEditors] = useState<PlanEditor[]>([]);
  useEffect(() => {
    if (plans) {
      setEditors(plans.map((p) => ({
        planId: p.planId, name: p.name, currentCents: p.priceCents,
        newDollars: String(p.priceCents / 100), changed: false,
      })));
    }
  }, [plans]);

  function handleChange(planId: string, val: string) {
    setEditors((prev) => prev.map((e) =>
      e.planId === planId ? { ...e, newDollars: val, changed: parseFloat(val) * 100 !== e.currentCents } : e,
    ));
  }

  async function handleSave(editor: PlanEditor) {
    const newCents = Math.round(parseFloat(editor.newDollars) * 100);
    if (isNaN(newCents) || newCents < 100) { toast({ title: "Price must be at least $1.00", variant: "destructive" }); return; }
    try {
      await updateMut.mutateAsync({ planId: editor.planId, priceCents: newCents });
      toast({ title: "Price updated", description: `${editor.name} → $${(newCents / 100).toFixed(0)}/mo` });
    } catch {
      toast({ title: "Failed to update price", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="Pricing">
      <div className="max-w-xl space-y-5">
        {/* Notice */}
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Price changes archive the current Stripe price and create a new one. Existing subscribers are unaffected until their next renewal cycle.
          </p>
        </div>

        {/* Plan editors */}
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-muted" /><div className="space-y-1.5"><div className="h-4 bg-muted rounded w-24" /><div className="h-3 bg-muted rounded w-48" /></div></div>
              <div className="h-9 bg-muted rounded-md" />
            </div>
          ))
        ) : (
          editors.map((editor) => {
            const meta = PLAN_META[editor.planId] ?? PLAN_META["solo"];
            const Icon = meta.icon;
            const perSeat = editor.planId === "organization";
            return (
              <div key={editor.planId} className="bg-card border border-border rounded-lg p-5 space-y-4">
                {/* Plan header */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                    <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground capitalize">{editor.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-muted-foreground">Current price</p>
                    <p className="text-base font-semibold text-foreground">${(editor.currentCents / 100).toFixed(0)}<span className="text-xs text-muted-foreground font-normal">/{perSeat ? "seat/mo" : "mo"}</span></p>
                  </div>
                </div>

                {/* Input row */}
                <div className="flex gap-2 items-center pt-1 border-t border-border">
                  <p className="text-sm text-muted-foreground shrink-0">New price</p>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number" min="1" step="1"
                      value={editor.newDollars}
                      onChange={(e) => handleChange(editor.planId, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && editor.changed && handleSave(editor)}
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleSave(editor)}
                    disabled={!editor.changed || updateMut.isPending}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-all disabled:opacity-40"
                    style={editor.changed
                      ? { background: "hsl(243,75%,59%)", color: "white" }
                      : { background: "#F1F5F9", color: "#94A3B8" }
                    }
                  >
                    {updateMut.isPending
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving</>
                      : <><Check className="w-3.5 h-3.5" />Update</>
                    }
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
}

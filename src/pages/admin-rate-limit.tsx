import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Gauge, Info, Check, Loader2, Shield } from "lucide-react";

interface RateLimitSettings {
  enabled: boolean;
  windowMs: number;
  aiMaxPerStudent: number;
  updatedAt: string | null;
  bounds: {
    minPerStudent: number;
    maxPerStudent: number;
    minWindowMs: number;
    maxWindowMs: number;
  };
}

export default function AdminRateLimit() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<RateLimitSettings>({
    queryKey: ["admin-rate-limit"],
    queryFn: () => apiRequest("/api/admin/rate-limit"),
  });

  const [enabled, setEnabled] = useState(true);
  const [perStudent, setPerStudent] = useState("30");
  const [windowSec, setWindowSec] = useState("60");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setPerStudent(String(data.aiMaxPerStudent));
    setWindowSec(String(Math.round(data.windowMs / 1000)));
  }, [data]);

  const n = Math.max(1, parseInt(perStudent, 10) || 0);
  const exampleSeats = 40;
  const orgExample = n * exampleSeats;

  const updateMut = useMutation({
    mutationFn: (body: { enabled: boolean; windowMs: number; aiMaxPerStudent: number }) =>
      apiRequest("/api/admin/rate-limit", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rate-limit"] }); },
  });

  async function handleSave() {
    if (!data) return;
    const aiMaxPerStudent = parseInt(perStudent, 10);
    const windowMs = parseInt(windowSec, 10) * 1000;
    if (
      Number.isNaN(aiMaxPerStudent) ||
      aiMaxPerStudent < data.bounds.minPerStudent ||
      aiMaxPerStudent > data.bounds.maxPerStudent
    ) {
      toast({
        title: `Per-student calls must be ${data.bounds.minPerStudent}–${data.bounds.maxPerStudent}`,
        variant: "destructive",
      });
      return;
    }
    if (
      Number.isNaN(windowMs) ||
      windowMs < data.bounds.minWindowMs ||
      windowMs > data.bounds.maxWindowMs
    ) {
      toast({
        title: `Window must be ${data.bounds.minWindowMs / 1000}–${data.bounds.maxWindowMs / 1000} seconds`,
        variant: "destructive",
      });
      return;
    }
    try {
      await updateMut.mutateAsync({ enabled, windowMs, aiMaxPerStudent });
      toast({ title: "Rate limits saved" });
    } catch {
      toast({ title: "Could not save rate limits", variant: "destructive" });
    }
  }

  return (
    <AdminLayout title="API rate limits" subtitle="Per-student caps for AI generation, scoring, and speech">
      <div className="max-w-xl space-y-5">
        <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
          <p className="text-sm text-sky-900 leading-relaxed">
            Every student is capped at the number you set. A school or district with{" "}
            <span className="font-semibold">X registered students</span> gets a pool of{" "}
            <span className="font-semibold">that number × X</span>. One student still cannot
            spend the whole pool.
          </p>
        </div>

        {isLoading || !data ? (
          <div className="bg-card border border-border rounded-lg p-5 animate-pulse h-64" />
        ) : (
          <div className="bg-card border border-border rounded-lg p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50">
                <Gauge className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Per-student AI calls</p>
                <p className="text-xs text-muted-foreground">
                  Session start, coaching, writing score, TTS/STT. Super admin only.
                </p>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground font-medium">Enforce limits</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Calls per student</p>
                <Input
                  type="number"
                  min={data.bounds.minPerStudent}
                  max={data.bounds.maxPerStudent}
                  value={perStudent}
                  onChange={(e) => setPerStudent(e.target.value)}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {data.bounds.minPerStudent}–{data.bounds.maxPerStudent}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Window (seconds)</p>
                <Input
                  type="number"
                  min={data.bounds.minWindowMs / 1000}
                  max={data.bounds.maxWindowMs / 1000}
                  value={windowSec}
                  onChange={(e) => setWindowSec(e.target.value)}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {data.bounds.minWindowMs / 1000}–{data.bounds.maxWindowMs / 1000}s
                </p>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
              Example: {exampleSeats} registered students × {n} calls ={" "}
              <span className="font-semibold text-foreground">{orgExample}</span> school/district
              calls per {windowSec || "60"}s. Each of those students is still limited to {n}.
            </div>

            <button
              onClick={handleSave}
              disabled={updateMut.isPending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "hsl(243,75%,59%)" }}
            >
              {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
          </div>
        )}

        <div className="flex gap-3 rounded-lg border border-border px-4 py-3">
          <Shield className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Students cannot raise their own cap. Values are clamped on the server.
            Only super admins can open this page.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}

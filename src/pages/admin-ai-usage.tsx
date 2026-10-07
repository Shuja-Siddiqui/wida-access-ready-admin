import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Coins, RefreshCw, ChevronLeft, ChevronRight, Zap, ArrowDownToLine, ArrowUpFromLine, Image,
} from "lucide-react";

interface AiUsageCall {
  id: string;
  studentId: string | null;
  studentName: string | null;
  userId: string | null;
  userName: string | null;
  actorName: string | null;
  actorType: "student" | "admin" | null;
  imageJobId: string | null;
  sessionId: string | null;
  sessionDomain: string | null;
  callKind: string;
  domain: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  pricingModel: string | null;
  priced: boolean;
  createdAt: string;
}

interface CallsResponse {
  calls: AiUsageCall[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  pageSummary: {
    callCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
  };
}

interface SummaryResponse {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  byCallKind: Array<{ callKind: string; calls: number; totalTokens: number; costUsd: number }>;
  byModel: Array<{ model: string; displayName: string | null; calls: number; totalTokens: number; costUsd: number }>;
  pricing: { fetchedAt: string; expiresAt: string; source: string };
}

interface PricingResponse {
  prices: Array<{
    modelId: string;
    displayName: string;
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
  }>;
  fetchedAt: string;
  expiresAt: string;
  source: string;
}

interface SessionUsageRow {
  sessionId: string;
  studentId: string;
  studentName: string | null;
  domain: string | null;
  completed: boolean;
  sessionStartedAt: string | null;
  lastCallAt: string;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
}

interface SessionsResponse {
  sessions: SessionUsageRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ImageFactoryJobRow {
  jobId: string;
  subject: string;
  level: number;
  complexityStep: number;
  keyUse: string | null;
  imageConcept: string | null;
  status: string;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
  tokenTracked: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string | null;
  totalCostUsd: number;
  priced: boolean;
}

interface ImageFactoryResponse {
  jobs: ImageFactoryJobRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  pageSummary: {
    jobCount: number;
    trackedPrompts: number;
    totalTokens: number;
    totalCostUsd: number;
  };
}

const CALL_KIND_LABELS: Record<string, string> = {
  content_generate: "Content generation",
  item_feedback:    "Item feedback",
  attempt_feedback: "Session feedback",
  feedback:         "Writing feedback",
  image_factory:    "Image prompt",
  speech:           "Speech",
  other:            "Other",
};

const IMAGE_FACTORY_STATUS_LABELS: Record<string, string> = {
  prompt_ready: "Prompt ready",
  generated:    "Image generated",
  ingested:     "In library",
  failed:       "Failed",
};

function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function StatCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-4 h-4" style={{ color }} strokeWidth={2} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminAiUsage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [imageFactoryPage, setImageFactoryPage] = useState(1);
  const [callKind, setCallKind] = useState("");
  const [sessionId, setSessionId] = useState("");

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (callKind) params.set("callKind", callKind);
  if (sessionId.trim()) params.set("sessionId", sessionId.trim());

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryResponse>({
    queryKey: ["admin-ai-usage-summary", callKind, sessionId],
    queryFn: () => {
      const p = new URLSearchParams();
      if (callKind) p.set("callKind", callKind);
      if (sessionId.trim()) p.set("sessionId", sessionId.trim());
      const q = p.toString();
      return apiRequest(`/api/admin/ai-usage/summary${q ? `?${q}` : ""}`);
    },
  });

  const { data: callsData, isLoading: callsLoading } = useQuery<CallsResponse>({
    queryKey: ["admin-ai-usage-calls", page, callKind, sessionId],
    queryFn: () => apiRequest(`/api/admin/ai-usage/calls?${params}`),
  });

  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    isError: sessionsError,
    error: sessionsErrorDetail,
  } = useQuery<SessionsResponse>({
    queryKey: ["admin-ai-usage-sessions", sessionsPage],
    queryFn: () => apiRequest(`/api/admin/ai-usage/sessions?page=${sessionsPage}&limit=25`),
  });

  const {
    data: imageFactoryData,
    isLoading: imageFactoryLoading,
    isError: imageFactoryError,
    error: imageFactoryErrorDetail,
  } = useQuery<ImageFactoryResponse>({
    queryKey: ["admin-ai-usage-image-factory", imageFactoryPage],
    queryFn: () => apiRequest(`/api/admin/ai-usage/image-factory?page=${imageFactoryPage}&limit=25`),
  });

  const { data: pricing } = useQuery<PricingResponse>({
    queryKey: ["admin-ai-usage-pricing"],
    queryFn: () => apiRequest("/api/admin/ai-usage/pricing"),
  });

  const refreshPricing = useMutation({
    mutationFn: () => apiRequest<PricingResponse>("/api/admin/ai-usage/pricing/refresh", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ai-usage-pricing"] });
      qc.invalidateQueries({ queryKey: ["admin-ai-usage-summary"] });
      qc.invalidateQueries({ queryKey: ["admin-ai-usage-calls"] });
      qc.invalidateQueries({ queryKey: ["admin-ai-usage-sessions"] });
      qc.invalidateQueries({ queryKey: ["admin-ai-usage-image-factory"] });
      toast({ title: "Model pricing refreshed" });
    },
    onError: () => toast({ title: "Could not refresh pricing", variant: "destructive" }),
  });

  const pagination = callsData?.pagination;
  const sessionsPagination = sessionsData?.pagination;
  const imageFactoryPagination = imageFactoryData?.pagination;

  function selectSession(id: string) {
    setSessionId(id);
    setPage(1);
    setCallKind("");
  }

  function clearSessionFilter() {
    setSessionId("");
    setPage(1);
  }

  return (
    <AdminLayout
      title="AI token usage"
      subtitle="Per-session rollups and per-call ledger with live Anthropic pricing"
    >
      <div className="space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 h-24 animate-pulse" />
            ))
          ) : (
            <>
              <StatCard
                label="Total calls"
                value={(summary?.callCount ?? 0).toLocaleString()}
                icon={Zap}
                color="#6366F1"
                bg="#EEF2FF"
              />
              <StatCard
                label="Total tokens"
                value={fmtTokens(summary?.totalTokens ?? 0)}
                sub={`${fmtTokens(summary?.inputTokens ?? 0)} in · ${fmtTokens(summary?.outputTokens ?? 0)} out`}
                icon={Coins}
                color="#0EA5E9"
                bg="#E0F2FE"
              />
              <StatCard
                label="Estimated cost"
                value={fmtUsd(summary?.totalCostUsd ?? 0)}
                sub="Live rates from Anthropic docs"
                icon={Coins}
                color="#10B981"
                bg="#D1FAE5"
              />
              <StatCard
                label="Pricing updated"
                value={pricing ? fmtTime(pricing.fetchedAt) : "—"}
                sub={pricing?.source === "fallback" ? "Using fallback table" : "From Anthropic docs"}
                icon={RefreshCw}
                color="#F59E0B"
                bg="#FEF3C7"
              />
            </>
          )}
        </div>

        {/* Filters + pricing refresh */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={callKind}
              onChange={(e) => { setCallKind(e.target.value); setPage(1); }}
              className="h-8 text-sm rounded-md border border-border bg-background px-2"
            >
              <option value="">All call types</option>
              {Object.entries(CALL_KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <Input
              value={sessionId}
              onChange={(e) => { setSessionId(e.target.value); setPage(1); }}
              placeholder="Filter by session ID…"
              className="h-8 w-64 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => refreshPricing.mutate()}
            disabled={refreshPricing.isPending}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshPricing.isPending ? "animate-spin" : ""}`} />
            Refresh model prices
          </button>
        </div>

        {/* Per-session rollups */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">Cost by session</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total AI cost for each practice session — click a row to drill into its calls
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-3 py-2 font-medium">Last activity</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Calls</th>
                  <th className="px-3 py-2 font-medium text-right">Tokens</th>
                  <th className="px-3 py-2 font-medium text-right">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {sessionsLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : sessionsError ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-destructive text-xs">
                    Could not load sessions — {(sessionsErrorDetail as Error)?.message ?? "API error"}. Redeploy api-server and run migration 0020.
                  </td></tr>
                ) : !sessionsData?.sessions.length ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No sessions with AI usage yet</td></tr>
                ) : (
                  sessionsData.sessions.map((session) => {
                    const selected = sessionId === session.sessionId;
                    return (
                      <tr
                        key={session.sessionId}
                        onClick={() => selectSession(session.sessionId)}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/20"
                        }`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {fmtTime(session.lastCallAt)}
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={session.studentName ?? session.studentId}>
                          {session.studentName ?? session.studentId.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2 capitalize text-xs">{session.domain ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium ${session.completed ? "text-emerald-600" : "text-amber-600"}`}>
                            {session.completed ? "Completed" : "In progress"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{session.callCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                          {fmtTokens(session.totalTokens)}
                          <span className="block text-[10px] text-muted-foreground">
                            {fmtTokens(session.inputTokens)} in · {fmtTokens(session.outputTokens)} out
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">{fmtUsd(session.totalCostUsd)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {sessionsPagination && sessionsPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {sessionsPagination.total.toLocaleString()} sessions · page {sessionsPagination.page} of {sessionsPagination.totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={sessionsPage <= 1}
                  onClick={() => setSessionsPage((p) => p - 1)}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={sessionsPage >= sessionsPagination.totalPages}
                  onClick={() => setSessionsPage((p) => p + 1)}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Image factory prompt usage */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Image factory — Claude prompt usage</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Super-admin image prompt generation (HF pipeline step 1)
              </p>
            </div>
            {imageFactoryData?.pageSummary && (
              <span className="text-xs text-muted-foreground">
                Page: {fmtTokens(imageFactoryData.pageSummary.totalTokens)} tokens · {fmtUsd(imageFactoryData.pageSummary.totalCostUsd)}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Level</th>
                  <th className="px-3 py-2 font-medium">Concept</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Tokens</th>
                  <th className="px-3 py-2 font-medium text-right">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {imageFactoryLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : imageFactoryError ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-destructive text-xs">
                    Could not load image factory jobs — {(imageFactoryErrorDetail as Error)?.message ?? "API error"}. Run <span className="font-mono">npm run db:migrate:all</span> (migration 0020).
                  </td></tr>
                ) : !imageFactoryData?.jobs.length ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No image prompt jobs yet</td></tr>
                ) : (
                  imageFactoryData.jobs.map((job) => (
                    <tr key={job.jobId} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {fmtTime(job.createdAt)}
                      </td>
                      <td className="px-3 py-2 max-w-[140px] truncate" title={job.createdByName ?? job.createdByEmail ?? undefined}>
                        {job.createdByName ?? job.createdByEmail ?? "—"}
                      </td>
                      <td className="px-3 py-2 capitalize text-xs">{job.subject.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">
                        L{job.level}
                        <span className="block text-[10px] text-muted-foreground">step {job.complexityStep}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[180px] truncate text-xs" title={job.imageConcept ?? undefined}>
                        {job.imageConcept ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs">{IMAGE_FACTORY_STATUS_LABELS[job.status] ?? job.status}</span>
                        {!job.tokenTracked && (
                          <span className="block text-[10px] text-muted-foreground">No token row</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {job.tokenTracked ? fmtTokens(job.totalTokens) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                        {job.tokenTracked ? fmtUsd(job.totalCostUsd) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {imageFactoryPagination && imageFactoryPagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {imageFactoryPagination.total.toLocaleString()} jobs · page {imageFactoryPagination.page} of {imageFactoryPagination.totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={imageFactoryPage <= 1}
                  onClick={() => setImageFactoryPage((p) => p - 1)}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={imageFactoryPage >= imageFactoryPagination.totalPages}
                  onClick={() => setImageFactoryPage((p) => p + 1)}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* By model breakdown */}
        {summary?.byModel && summary.byModel.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Cost by model</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium text-right">Calls</th>
                    <th className="px-4 py-2 font-medium text-right">Tokens</th>
                    <th className="px-4 py-2 font-medium text-right">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byModel
                    .sort((a, b) => b.costUsd - a.costUsd)
                    .map((row) => (
                      <tr key={row.model} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          <span className="font-medium">{row.displayName ?? row.model}</span>
                          {row.displayName && row.model !== "unknown" && (
                            <span className="block text-xs text-muted-foreground font-mono">{row.model}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.calls}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtTokens(row.totalTokens)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtUsd(row.costUsd)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Per-call ledger */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium">Per-call ledger</h3>
              {sessionId.trim() && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    Filtered to session <span className="font-mono">{sessionId.trim().slice(0, 8)}…</span>
                    {summary && (
                      <> · {fmtTokens(summary.totalTokens)} tokens · {fmtUsd(summary.totalCostUsd)} total</>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={clearSessionFilter}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            {callsData?.pageSummary && (
              <span className="text-xs text-muted-foreground">
                Page: {fmtTokens(callsData.pageSummary.totalTokens)} tokens · {fmtUsd(callsData.pageSummary.totalCostUsd)}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium text-right">
                    <span className="inline-flex items-center gap-1 justify-end"><ArrowDownToLine className="w-3 h-3" />In</span>
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    <span className="inline-flex items-center gap-1 justify-end"><ArrowUpFromLine className="w-3 h-3" />Out</span>
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {callsLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : !callsData?.calls.length ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No AI calls recorded yet</td></tr>
                ) : (
                  callsData.calls.map((call) => (
                    <tr key={call.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {fmtTime(call.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium">{CALL_KIND_LABELS[call.callKind] ?? call.callKind}</span>
                        {(call.domain ?? call.sessionDomain) && (
                          <span className="block text-[10px] text-muted-foreground capitalize">
                            {call.domain ?? call.sessionDomain}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[140px] truncate" title={call.actorName ?? undefined}>
                        {call.actorType === "admin" && (
                          <span className="block text-[10px] text-muted-foreground uppercase tracking-wide">Admin</span>
                        )}
                        {call.actorName ?? (call.studentId ?? call.userId ?? "—").slice(0, 8)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs">{call.model ?? "—"}</span>
                        {call.pricingModel && call.pricingModel !== call.model && (
                          <span className="block text-[10px] text-muted-foreground">{call.pricingModel}</span>
                        )}
                        {!call.priced && (
                          <span className="block text-[10px] text-amber-600">Unpriced</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{call.inputTokens.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{call.outputTokens.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">{fmtUsd(call.totalCostUsd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {pagination.total.toLocaleString()} calls · page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Current rate card */}
        {pricing && pricing.prices.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Current Anthropic rates (USD / 1M tokens)</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {pricing.prices.slice(0, 9).map((p) => (
                <div key={p.modelId} className="text-xs border border-border rounded px-3 py-2">
                  <p className="font-medium truncate">{p.displayName}</p>
                  <p className="text-muted-foreground font-mono mt-0.5">
                    in ${p.inputPerMillionUsd} · out ${p.outputPerMillionUsd}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

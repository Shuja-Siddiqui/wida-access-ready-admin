import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, ImageIcon, Download, AlertCircle, CheckCircle2,
  RefreshCw, ChevronDown, Wand2, Crosshair, Save, Factory,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImageFactorySubject = "ela" | "math" | "science" | "social_studies";
type ImageFactoryLevel = 1 | 2 | 3 | 4 | 5 | 6;
type KeyUse = "Narrate" | "Inform" | "Explain" | "Argue";

interface PoolSummary {
  subject: ImageFactorySubject;
  level: ImageFactoryLevel;
  lastComplexityStep: number;
  lastGeneratedAt: string | null;
  libraryImageCount: number;
  academicContext: string;
}

interface GenerateStatus {
  hfInferenceConfigured: boolean;
  fluxSidecarReady: boolean;
  activeSource: "hf-inference" | "flux-sidecar" | null;
}

interface PromptResult {
  jobId: string;
  hfPrompt: string;
  suggestedObjects: string[];
  imageConcept: string;
  complexityStep: number;
  complexityLabel: string;
  rationale: string;
  previousComplexityStep: number;
  academicUnit?: string | null;
  academicScenario?: string | null;
  tier3Vocabulary?: string[];
  topicLabel?: string | null;
}

interface GenerateResult {
  image: string;
  width: number;
  height: number;
  seed?: number;
  numInferenceSteps: number;
  source: "hf-inference" | "flux-sidecar";
  model?: string;
}

interface DetectResult {
  candidates: string[];
  confirmedTags: string[];
  description: string;
  imageConcept: string | null;
  detections: { label: string; score: number; box: Record<string, number> }[];
  model: string;
}

interface IngestResult {
  libraryImageId: string;
  tags: string[];
  confirmedTags: string[];
  complexityStep: number;
  complexityLabel: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECTS: { value: ImageFactorySubject; label: string }[] = [
  { value: "ela", label: "English Language Arts" },
  { value: "math", label: "Mathematics" },
  { value: "science", label: "Science" },
  { value: "social_studies", label: "Social Studies / History" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminImageFactory() {
  const { toast } = useToast();

  const [subject, setSubject] = useState<ImageFactorySubject>("math");
  const [level, setLevel] = useState<ImageFactoryLevel>(1);
  const [keyUse, setKeyUse] = useState<KeyUse | "">("");
  const [hfPrompt, setHfPrompt] = useState("");
  const [promptMeta, setPromptMeta] = useState<PromptResult | null>(null);
  const [rationaleOpen, setRationaleOpen] = useState(false);

  const [width, setWidth] = useState("768");
  const [height, setHeight] = useState("512");
  const [seed, setSeed] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [ingestedId, setIngestedId] = useState<string | null>(null);

  const { data: pools, isLoading: poolsLoading, refetch: refetchPools } = useQuery<{ pools: PoolSummary[] }>({
    queryKey: ["admin-image-factory-pools"],
    queryFn: () => apiRequest("/api/admin/images/pools"),
  });

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<GenerateStatus>({
    queryKey: ["admin-image-generate-status"],
    queryFn: () => apiRequest("/api/admin/images/generate-status"),
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: keyUsesData } = useQuery<{ subject: ImageFactorySubject; keyUses: KeyUse[] }>({
    queryKey: ["admin-image-factory-key-uses", subject],
    queryFn: () => apiRequest(`/api/admin/images/key-uses?subject=${encodeURIComponent(subject)}`),
  });

  const keyUsesForSubject = useMemo(
    () => keyUsesData?.keyUses ?? [],
    [keyUsesData?.keyUses],
  );

  useEffect(() => {
    if (keyUse && !keyUsesForSubject.includes(keyUse)) {
      setKeyUse("");
    }
  }, [subject, keyUsesForSubject, keyUse]);

  const selectedPool = useMemo(
    () => pools?.pools.find((p) => p.subject === subject && p.level === level),
    [pools, subject, level],
  );

  const promptMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { subject, level };
      if (keyUse) body.keyUse = keyUse;
      return apiRequest<PromptResult>("/api/admin/images/generate-prompt", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setPromptMeta(data);
      setHfPrompt(data.hfPrompt);
      setResult(null);
      setRationaleOpen(true);
      toast({ title: "Prompt generated", description: data.complexityLabel });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Prompt generation failed";
      toast({ title: message, variant: "destructive" });
    },
  });

  const generateMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        prompt: hfPrompt.trim(),
        width: parseInt(width, 10),
        height: parseInt(height, 10),
      };
      if (seed.trim()) body.seed = parseInt(seed, 10);
      if (promptMeta?.jobId) body.jobId = promptMeta.jobId;
      return apiRequest<GenerateResult>("/api/admin/images/generate-from-prompt", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setDetectResult(null);
      setIngestedId(null);
      toast({ title: "Image generated" });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Generation failed";
      toast({ title: message, variant: "destructive" });
    },
  });

  function handleGeneratePrompt() {
    setPromptMeta(null);
    promptMut.mutate();
  }

  const detectMut = useMutation({
    mutationFn: () => {
      if (!promptMeta?.jobId || !result?.image) {
        throw new Error("Generate a prompt and image first");
      }
      return apiRequest<DetectResult>("/api/admin/images/detect-generated", {
        method: "POST",
        body: JSON.stringify({ jobId: promptMeta.jobId, image: result.image }),
      });
    },
    onSuccess: (data) => {
      setDetectResult(data);
      setIngestedId(null);
      toast({
        title: "DINO complete",
        description: `${data.detections.length} box(es) · ${data.confirmedTags.length} tag(s)`,
      });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Detection failed";
      toast({ title: message, variant: "destructive" });
    },
  });

  const ingestMut = useMutation({
    mutationFn: () => {
      if (!promptMeta?.jobId || !result?.image) {
        throw new Error("Generate a prompt and image first");
      }
      const body: Record<string, unknown> = {
        jobId: promptMeta.jobId,
        image: result.image,
      };
      if (detectResult?.detections?.length) {
        body.detections = detectResult.detections;
      }
      if (result?.source) {
        body.generationBackend = result.source;
      }
      return apiRequest<IngestResult>("/api/admin/images/ingest-generated", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setIngestedId(data.libraryImageId);
      void refetchPools();
      toast({
        title: "Saved to library",
        description: `${data.complexityLabel} · ${data.confirmedTags.length} tags`,
      });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: message, variant: "destructive" });
    },
  });

  function handleGenerateImage() {
    if (!hfPrompt.trim()) {
      toast({ title: "Generate or enter a prompt first", variant: "destructive" });
      return;
    }
    setResult(null);
    generateMut.mutate();
  }

  const sourceLabel =
    status?.activeSource === "hf-inference"
      ? "Hugging Face Inference (cloud)"
      : status?.activeSource === "flux-sidecar"
        ? "Local FLUX sidecar"
        : "Not configured";

  return (
    <AdminLayout
      title="Image Factory"
      subtitle="Claude prompt → review → HF image for the writing library"
    >
      <div className="max-w-6xl space-y-6">
        {/* Status bar */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            {statusLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : status?.activeSource ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            )}
            <span className="text-sm font-medium">
              Backend: {statusLoading ? "Checking…" : sourceLabel}
            </span>
          </div>
          <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">
            ~$0.003 / image (HF FLUX Schnell)
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { refetchStatus(); refetchPools(); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>

        {!statusLoading && !status?.activeSource && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Set <code className="font-mono text-xs bg-amber-100 px-1 rounded">HF_TOKEN</code> in api-server{" "}
            <code className="font-mono text-xs bg-amber-100 px-1 rounded">.env</code> to generate images.
            Prompt generation still works without HF.
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: pool + prompt */}
          <div className="space-y-4">
            {/* Pool selector */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pool</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="subject">Standard Framework</Label>
                  <select
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as ImageFactorySubject)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">ELP level</Label>
                  <select
                    id="level"
                    value={level}
                    onChange={(e) => setLevel(parseInt(e.target.value, 10) as ImageFactoryLevel)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>Level {n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {poolsLoading ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading pool stats…
                </p>
              ) : selectedPool && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    Complexity step: {selectedPool.lastComplexityStep}
                  </Badge>
                  <Badge variant="outline">
                    Library images: {selectedPool.libraryImageCount}
                  </Badge>
                  <Badge variant="outline">
                    Context: {selectedPool.academicContext}
                  </Badge>
                  {selectedPool.lastGeneratedAt && (
                    <Badge variant="outline">
                      Last generated: {new Date(selectedPool.lastGeneratedAt).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-5 space-y-2">
              <Label htmlFor="keyUse">Key language use (optional)</Label>
              <select
                id="keyUse"
                value={keyUse}
                onChange={(e) => setKeyUse(e.target.value as KeyUse | "")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Default for subject —</option>
                {keyUsesForSubject.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              {keyUsesForSubject.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Unit, scenario, tier-3 vocabulary, and framework PLD are filled automatically from
                  Standard Framework and level. Allowed: {keyUsesForSubject.join(", ")}.
                </p>
              )}
            </div>

            {/* Prompt */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">HF prompt</span>
                {promptMeta && (
                  <Badge>{promptMeta.complexityLabel}</Badge>
                )}
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={handleGeneratePrompt}
                disabled={promptMut.isPending}
              >
                {promptMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Claude is writing prompt…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate prompt (Claude)
                  </>
                )}
              </Button>

              <div className="space-y-2">
                <Label htmlFor="hfPrompt">Editable prompt</Label>
                <Textarea
                  id="hfPrompt"
                  rows={6}
                  value={hfPrompt}
                  onChange={(e) => setHfPrompt(e.target.value)}
                  placeholder="Generate a prompt above, or type your own…"
                  className="resize-y min-h-[140px] font-mono text-xs"
                />
              </div>

              {promptMeta && (promptMeta.academicScenario || (promptMeta.tier3Vocabulary?.length ?? 0) > 0) && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1.5 text-xs">
                  <p className="font-medium text-sm text-foreground">Content pipeline context</p>
                  {promptMeta.topicLabel && <p><span className="text-muted-foreground">Topic:</span> {promptMeta.topicLabel}</p>}
                  {promptMeta.academicUnit && <p><span className="text-muted-foreground">Unit:</span> {promptMeta.academicUnit}</p>}
                  {promptMeta.academicScenario && <p><span className="text-muted-foreground">Scenario:</span> {promptMeta.academicScenario}</p>}
                  {(promptMeta.tier3Vocabulary?.length ?? 0) > 0 && (
                    <p><span className="text-muted-foreground">Tier-3:</span> {promptMeta.tier3Vocabulary!.join(", ")}</p>
                  )}
                </div>
              )}

              {promptMeta && (
                <div className="space-y-3">
                  {promptMeta.imageConcept && (
                    <p className="text-sm">
                      <span className="font-medium">Concept:</span>{" "}
                      {promptMeta.imageConcept}
                    </p>
                  )}
                  {promptMeta.suggestedObjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground w-full">Suggested DINO objects</span>
                      {promptMeta.suggestedObjects.map((obj) => (
                        <Badge key={obj} variant="outline">{obj}</Badge>
                      ))}
                    </div>
                  )}
                  <Collapsible open={rationaleOpen} onOpenChange={setRationaleOpen}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${rationaleOpen ? "rotate-180" : ""}`} />
                      Claude rationale
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 text-xs text-muted-foreground">
                      {promptMeta.rationale}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                <div className="space-y-2">
                  <Label htmlFor="width">Width</Label>
                  <Input id="width" type="number" min={64} max={2048} value={width} onChange={(e) => setWidth(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Input id="height" type="number" min={64} max={2048} value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seed">Seed</Label>
                  <Input id="seed" type="number" placeholder="Random" value={seed} onChange={(e) => setSeed(e.target.value)} />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleGenerateImage}
                disabled={generateMut.isPending || !status?.activeSource || !hfPrompt.trim()}
              >
                {generateMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating image…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate image (HF)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right: preview */}
          <div className="bg-card border border-border rounded-lg p-5 flex flex-col min-h-[520px]">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preview</span>
              {promptMeta?.jobId && (
                <span className="text-xs text-muted-foreground ml-auto font-mono truncate max-w-[180px]">
                  job {promptMeta.jobId.slice(0, 8)}…
                </span>
              )}
            </div>

            {generateMut.isPending && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm text-center max-w-xs">
                  Waiting for HF. Cold starts can take up to a minute.
                </p>
              </div>
            )}

            {!generateMut.isPending && !result && (
              <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                <p className="text-sm text-muted-foreground text-center px-6">
                  Generate a Claude prompt, review it, then submit to HF.
                  <br />
                  <span className="text-xs">Run DINO, then save to the writing library.</span>
                </p>
              </div>
            )}

            {result && !generateMut.isPending && (
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex-1 flex items-center justify-center rounded-lg bg-muted/30 overflow-hidden min-h-[320px]">
                  <img
                    src={result.image}
                    alt="Generated"
                    className="max-w-full max-h-[420px] object-contain rounded"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Source:</span> {result.source}
                    {result.model ? ` · ${result.model}` : ""}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Size:</span> {result.width}×{result.height}
                    {result.seed != null && (
                      <> · <span className="font-medium text-foreground">Seed:</span> {result.seed}</>
                    )}
                  </p>
                </div>
                {detectResult && detectResult.confirmedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground w-full">DINO confirmed tags</span>
                    {detectResult.confirmedTags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}

                {ingestedId && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Library id {ingestedId.slice(0, 8)}… — pool complexity updated
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={detectMut.isPending || ingestMut.isPending || !!ingestedId}
                    onClick={() => detectMut.mutate()}
                  >
                    {detectMut.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Crosshair className="w-4 h-4 mr-2" />
                    )}
                    Run DINO
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      ingestMut.isPending
                      || !!ingestedId
                      || !detectResult
                      || (detectResult?.detections?.length ?? 0) === 0
                    }
                    onClick={() => ingestMut.mutate()}
                  >
                    {ingestMut.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save to library
                  </Button>
                  <a href={result.image} download={`factory-${Date.now()}.png`} className="inline-flex">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

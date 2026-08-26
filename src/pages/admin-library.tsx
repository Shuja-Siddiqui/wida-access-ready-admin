import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ImageIcon, Upload, Trash2, ChevronLeft, ChevronRight,
  X, Tag, FileText, AlertCircle, CheckCircle2, Loader2,
  Sparkles, Layers, Check, ChevronDown, SlidersHorizontal, PenLine,
  SquareCheck, Square, ListChecks, BookOpen, Crosshair,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  s3Key: string;
  contentType: string;
  sizeBytes: number | null;
  tags: string[];
  description: string | null;
  detectionResults: Record<string, unknown> | null;
  uploaderId: string | null;
  uploaderEmail: string | null;
  uploaderName: string | null;
  createdAt: string;
  /** Original full-resolution presigned URL */
  imageUrl: string | null;
  /** 200 px-wide thumbnail presigned URL (null for images uploaded before this feature) */
  thumbnailUrl: string | null;
  /** 600 px-wide medium presigned URL (null for images uploaded before this feature) */
  mediumUrl: string | null;
  topicCount: number;
  contexts: string[];
  /** Specific concept depicted, e.g. "Chromosomes", "Westward Expansion" */
  imageConcept: string | null;
}

interface LibraryResponse {
  items: LibraryItem[];
  total: number;
  limit: number;
  offset: number;
}

interface AnalyzeResult {
  candidates:        string[];
  confirmedTags:     string[];
  description:       string;
  imageConcept:      string | null;
  suggestedTopicIds: string[];
  detections:        AnnotateDetection[];
}

interface FlatTopic {
  id: string;
  name: string;
  slug: string;
  themeId: string;
  themeName: string;
  displayOrder: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Manage Topics Modal ───────────────────────────────────────────────────────

function ManageTopicsModal({
  item,
  onClose,
  onSaved,
}: {
  item: LibraryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Load flat topics list
  const { data: topicsData, isLoading: topicsLoading } = useQuery<{ topics: FlatTopic[] }>({
    queryKey: ["admin-topics-flat"],
    queryFn: () => apiRequest("/api/admin/topics"),
    staleTime: 60_000,
  });

  // Load current assignments for this image
  const { data: assignedData, isLoading: assignedLoading } = useQuery<{ topicIds: string[] }>({
    queryKey: ["admin-library-topics", item.id],
    queryFn: () => apiRequest(`/api/admin/library/${item.id}/topics`),
  });

  // Initialise checkboxes once both loads are done
  useEffect(() => {
    if (assignedData) {
      setSelected(new Set(assignedData.topicIds));
    }
  }, [assignedData]);

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      apiRequest(`/api/admin/library/${item.id}/topics`, {
        method: "PUT",
        body: JSON.stringify({ topicIds: Array.from(selected) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-library"] });
      qc.invalidateQueries({ queryKey: ["admin-library-topics", item.id] });
      onSaved();
      onClose();
    },
  });

  const isLoading = topicsLoading || assignedLoading;

  // Group by theme
  const grouped = (topicsData?.topics ?? []).reduce<Record<string, { themeName: string; topics: FlatTopic[] }>>(
    (acc, t) => {
      if (!acc[t.themeId]) acc[t.themeId] = { themeName: t.themeName, topics: [] };
      acc[t.themeId]!.topics.push(t);
      return acc;
    },
    {},
  );

  const lc = search.toLowerCase();
  const filteredGrouped = Object.entries(grouped).reduce<typeof grouped>((acc, [themeId, g]) => {
    const matched = g.topics.filter(
      (t) => !lc || t.name.toLowerCase().includes(lc) || t.themeName.toLowerCase().includes(lc),
    );
    if (matched.length) acc[themeId] = { themeName: g.themeName, topics: matched };
    return acc;
  }, {});

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Close on backdrop click
  function onBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onBackdrop}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "hsl(243,75%,59%,0.12)" }}>
            <Layers className="w-4 h-4" style={{ color: "hsl(243,75%,59%)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Assign Topics</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {item.s3Key.split("/").pop()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter topics…"
            className="h-8 text-sm"
          />
        </div>

        {/* Topic list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading topics…</span>
            </div>
          ) : Object.keys(filteredGrouped).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No topics found.</p>
          ) : (
            <div className="space-y-4">
              {Object.values(filteredGrouped).map(({ themeName, topics }) => (
                <div key={themeName}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {themeName}
                  </p>
                  <div className="space-y-1">
                    {topics.map((t) => {
                      const checked = selected.has(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggle(t.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer hover:bg-muted/60"
                          style={checked ? { background: "hsl(243,75%,59%,0.08)" } : {}}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
                            style={checked
                              ? { background: "hsl(243,75%,59%)", borderColor: "hsl(243,75%,59%)" }
                              : { borderColor: "#D1D5DB" }
                            }
                          >
                            {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-sm text-foreground">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            {selected.size} topic{selected.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}
              className="text-xs cursor-pointer">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => save()}
              disabled={saving || isLoading}
              className="text-xs gap-1.5 cursor-pointer"
              style={{ background: "hsl(243,75%,59%)", color: "white" }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Context options ───────────────────────────────────────────────────────────

const CONTEXT_OPTIONS = [
  { value: "general",                label: "Everyday Topics",  desc: "General social listening (school, food, health…)" },
  { value: "academic:math",          label: "Mathematics",      desc: "Counting, measurement, word problems" },
  { value: "academic:science",       label: "Science",          desc: "Tools, natural objects, phenomena" },
  { value: "academic:social_studies",label: "Social Studies",   desc: "Maps, flags, historical places" },
  { value: "academic:ela",           label: "ELA",              desc: "Books, writing, reading materials" },
] as const;

// ── Upload panel ──────────────────────────────────────────────────────────────

function UploadPanel({ onSuccess }: { onSuccess: () => void }) {
  const [preview, setPreview]         = useState<string | null>(null);
  const [dataUri, setDataUri]         = useState<string | null>(null);
  const [fileName, setFileName]       = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [imageConcept, setImageConcept] = useState("");
  const [tagInput, setTagInput]       = useState("");
  const [tags, setTags]               = useState<string[]>([]);
  const [contexts, setContexts]       = useState<Set<string>>(new Set());
  const [topicIds, setTopicIds]           = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [aiDetected, setAiDetected]           = useState(false);
  const [detectError, setDetectError]         = useState<string | null>(null);
  const [uploadError, setUploadError]         = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);
  const [dragging, setDragging]               = useState(false);
  const [pendingDetections, setPendingDetections] = useState<AnnotateDetection[]>([]);
  const [showAnnotate, setShowAnnotate]       = useState(false);
  const [visionTags, setVisionTags]           = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Flat topics list — grouped by theme for picker + display
  const { data: topicsData } = useQuery<{ topics: FlatTopic[] }>({
    queryKey: ["admin-topics-flat"],
    queryFn: () => apiRequest("/api/admin/topics"),
    staleTime: 5 * 60_000,
  });
  const topicsById = Object.fromEntries((topicsData?.topics ?? []).map((t) => [t.id, t]));
  const grouped = (topicsData?.topics ?? []).reduce<
    Record<string, { themeId: string; themeName: string; topics: FlatTopic[] }>
  >((acc, t) => {
    if (!acc[t.themeId]) acc[t.themeId] = { themeId: t.themeId, themeName: t.themeName, topics: [] };
    acc[t.themeId]!.topics.push(t);
    return acc;
  }, {});

  const { mutate: analyze, isPending: isAnalyzing } = useMutation({
    mutationFn: () =>
      apiRequest<AnalyzeResult>("/api/admin/library/analyze", {
        method: "POST",
        body: JSON.stringify({ image: dataUri }),
      }),
    onSuccess: (data) => {
      setDescription(data.description);
      if (data.imageConcept) setImageConcept(data.imageConcept);
      setTags(data.confirmedTags);
      setVisionTags(
        (data.candidates ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      );
      setPendingDetections(data.detections ?? []);
      const suggested = new Set(data.suggestedTopicIds ?? []);
      setTopicIds(suggested);
      // Auto-expand themes that have suggested topics
      const themes = new Set(
        (data.suggestedTopicIds ?? [])
          .map((id) => topicsById[id]?.themeId)
          .filter((id): id is string => !!id),
      );
      setExpandedThemes(themes);
      setAiDetected(true);
      setDetectError(null);
    },
    onError: (err) => {
      setDetectError(err instanceof ApiError ? err.message : "AI detection failed");
    },
  });

  const { mutate: upload, isPending: isUploading } = useMutation({
    mutationFn: () =>
      apiRequest<{ item: LibraryItem }>("/api/admin/library/upload", {
        method: "POST",
        body: JSON.stringify({
          image:       dataUri,
          description: description   || undefined,
          imageConcept: imageConcept.trim() || undefined,
          tags,
          visionTags,
          contexts:    Array.from(contexts),
          topicIds:    Array.from(topicIds),
          // Include hand-curated detections if the admin edited boxes — skips DINO on server
          ...(pendingDetections.length > 0 ? { detections: pendingDetections } : {}),
        }),
      }),
    onSuccess: () => {
      setPreview(null); setDataUri(null); setFileName(null);
      setDescription(""); setImageConcept(""); setTagInput(""); setTags([]);
      setContexts(new Set()); setTopicIds(new Set()); setPickerOpen(false); setExpandedThemes(new Set());
      setAiDetected(false); setDetectError(null); setUploadError(null);
      setPendingDetections([]); setShowAnnotate(false); setVisionTags([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onSuccess();
    },
    onError: (err) => {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    },
  });

  async function handleFile(file: File) {
    setUploadError(null); setDetectError(null); setAiDetected(false);
    if (!file.type.startsWith("image/")) { setUploadError("Only image files are supported."); return; }
    if (file.size > 20 * 1024 * 1024) { setUploadError("File too large — max 20 MB."); return; }
    const uri = await readFileAsDataURL(file);
    setDataUri(uri); setPreview(uri); setFileName(file.name);
  }

  function clearImage() {
    setPreview(null); setDataUri(null); setFileName(null);
    setDescription(""); setImageConcept(""); setTags([]); setTagInput("");
    setContexts(new Set()); setTopicIds(new Set()); setPickerOpen(false); setExpandedThemes(new Set());
    setAiDetected(false); setDetectError(null); setUploadError(null);
    setPendingDetections([]); setShowAnnotate(false); setVisionTags([]);
  }

  function addTag() {
    const val = tagInput.trim().toLowerCase();
    if (val && !tags.includes(val)) setTags((t) => [...t, val]);
    setTagInput("");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const isBusy = isAnalyzing || isUploading;

  return (
    <>
    {showAnnotate && dataUri && (
      <AnnotateModal
        mode="upload"
        imageUrl={dataUri}
        initialDetections={pendingDetections}
        suggestedLabels={visionTags}
        onClose={() => setShowAnnotate(false)}
        onSaved={(dets) => {
          setPendingDetections(dets);
          setTags((prev) => [...new Set([...prev, ...dets.map((d) => d.label)])]);
        }}
      />
    )}
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: "hsl(243,75%,59%,0.12)" }}>
          <Upload className="w-4 h-4" style={{ color: "hsl(243,75%,59%)" }} />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Upload Image</h3>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Drop zone */}
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer select-none"
          style={{
            width: 200, height: 200, flexShrink: 0,
            borderColor: dragging ? "hsl(243,75%,59%)" : preview ? "transparent" : "#E2E8F0",
            background: preview ? "#000" : dragging ? "hsl(243,75%,59%,0.04)" : "#FAFAFA",
            overflow: "hidden", position: "relative",
          }}
          onClick={() => !preview && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {preview ? (
            <>
              <img src={preview} alt="preview" className="w-full h-full object-contain" />
              <button
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); clearImage(); }}
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground text-center px-4">
                {dragging ? "Drop to upload" : "Click or drag & drop"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">JPEG · PNG · WebP · max 20 MB</p>
            </>
          )}
          <input
            ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </div>

        {/* Metadata */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            {fileName
              ? <p className="text-xs text-muted-foreground truncate"><span className="font-medium text-foreground">{fileName}</span></p>
              : <p className="text-xs text-muted-foreground">No image selected</p>
            }
            {dataUri && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => analyze()}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  style={aiDetected
                    ? { background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)", borderColor: "hsl(243,75%,59%,0.30)" }
                    : { background: "white", color: "#374151", borderColor: "#E5E7EB" }
                  }
                >
                  {isAnalyzing
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Detecting…</>
                    : <><Sparkles className="w-3 h-3" /> {aiDetected ? "Re-detect" : "Auto-detect"}</>
                  }
                </button>
                {aiDetected && (
                  <button
                    onClick={() => setShowAnnotate(true)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    style={pendingDetections.length > 0 && pendingDetections.some(d => d.source === "manual")
                      ? { background: "hsl(142,72%,29%,0.10)", color: "hsl(142,72%,29%)", borderColor: "hsl(142,72%,29%,0.30)" }
                      : { background: "white", color: "#374151", borderColor: "#E5E7EB" }
                    }
                  >
                    <PenLine className="w-3 h-3" />
                    Edit Boxes
                    {pendingDetections.length > 0 && (
                      <span className="rounded-full px-1 text-[10px] font-bold"
                        style={{ background: "hsl(243,75%,59%,0.15)", color: "hsl(243,75%,49%)" }}>
                        {pendingDetections.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {detectError && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-amber-50 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">{detectError}</p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <FileText className="w-3.5 h-3.5" />
              Description
              {aiDetected && description && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={dataUri ? "Click Auto-detect or type a description…" : "Select an image first"}
              disabled={!dataUri || isBusy}
              rows={3}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Concept — the specific idea this image depicts, used to anchor Claude's passage */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              Concept
              {aiDetected && imageConcept && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </label>
            <Input
              value={imageConcept}
              onChange={(e) => setImageConcept(e.target.value)}
              placeholder="e.g. Chromosomes, Westward Expansion…"
              disabled={!dataUri || isBusy}
              className="h-8 text-sm"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Tag className="w-3.5 h-3.5" />
              Tags
              {aiDetected && tags.length > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                  <Sparkles className="w-2.5 h-2.5" /> AI · DINO verified
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                placeholder={dataUri ? "Type a tag and press Enter" : "Select an image first"}
                disabled={!dataUri || isBusy}
                className="h-8 text-sm"
              />
              <Button variant="outline" size="sm" onClick={addTag} disabled={!dataUri || isBusy} className="h-8 px-3 text-xs cursor-pointer">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}
                  >
                    {t}
                    <button
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      disabled={isBusy}
                      className="hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {aiDetected && visionTags.filter((t) => !tags.includes(t)).length > 0 && (
              <div className="mt-2.5 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-2">
                <p className="text-[10px] font-medium text-amber-800 mb-1.5 leading-snug">
                  Vision found these, DINO did not box them. Click to add to tags, then Edit Boxes to draw a box.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {visionTags.filter((t) => !tags.includes(t)).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setTags((prev) => prev.includes(t) ? prev : [...prev, t])}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {t}
                      <span className="text-[10px] opacity-60">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Usage Context — visible once an image is selected */}
          {dataUri && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Usage Context</span>
                {contexts.size > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                    {contexts.size} selected
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CONTEXT_OPTIONS.map((opt) => {
                  const checked = contexts.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setContexts((prev) => {
                        const n = new Set(prev);
                        n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value);
                        return n;
                      })}
                      disabled={isBusy}
                      className="flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      style={checked
                        ? { borderColor: "hsl(243,75%,59%,0.5)", background: "hsl(243,75%,59%,0.06)" }
                        : { borderColor: "#E5E7EB", background: "white" }
                      }
                    >
                      <div
                        className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all mt-0.5"
                        style={checked
                          ? { background: "hsl(243,75%,59%)", borderColor: "hsl(243,75%,59%)" }
                          : { borderColor: "#D1D5DB" }
                        }
                      >
                        {checked && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground leading-none">{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Theme & Topics — always visible once an image is selected */}
          {dataUri && (
            <div className="space-y-2">
              {/* Section header */}
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Theme &amp; Topics</span>
                {aiDetected && topicIds.size > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                    <Sparkles className="w-2.5 h-2.5" /> AI suggested
                  </span>
                )}
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  disabled={isBusy}
                  className="ml-auto flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  {pickerOpen ? "Hide picker" : "Choose manually"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Selected topics grouped by theme */}
              {topicIds.size > 0 ? (
                <div className="space-y-2">
                  {Object.values(grouped).map(({ themeId, themeName, topics }) => {
                    const selected = topics.filter((t) => topicIds.has(t.id));
                    if (!selected.length) return null;
                    return (
                      <div key={themeId} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          {themeName}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selected.map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: "hsl(262,60%,94%)", color: "hsl(262,45%,38%)" }}
                            >
                              {t.name}
                              <button
                                onClick={() => setTopicIds((prev) => { const n = new Set(prev); n.delete(t.id); return n; })}
                                disabled={isBusy}
                                className="hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !pickerOpen && (
                  <p className="text-xs text-muted-foreground/50 italic">
                    {aiDetected ? "AI found no matching topics." : "Run Auto-detect or choose manually below."}
                  </p>
                )
              )}

              {/* Inline manual picker — accordion per theme */}
              {pickerOpen && (
                <div className="rounded-lg border border-border overflow-hidden">
                  {Object.values(grouped).map(({ themeId, themeName, topics }, idx) => {
                    const isExpanded = expandedThemes.has(themeId);
                    const selectedCount = topics.filter((t) => topicIds.has(t.id)).length;
                    return (
                      <div key={themeId} className={idx > 0 ? "border-t border-border" : ""}>
                        {/* Theme row */}
                        <button
                          onClick={() =>
                            setExpandedThemes((prev) => {
                              const n = new Set(prev);
                              n.has(themeId) ? n.delete(themeId) : n.add(themeId);
                              return n;
                            })
                          }
                          disabled={isBusy}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                          <span className="text-xs font-semibold text-foreground flex-1 text-left">{themeName}</span>
                          {selectedCount > 0 && (
                            <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5"
                              style={{ background: "hsl(262,60%,94%)", color: "hsl(262,45%,38%)" }}>
                              {selectedCount} selected
                            </span>
                          )}
                        </button>

                        {/* Topics checkboxes */}
                        {isExpanded && (
                          <div className="px-3 pb-2.5 grid grid-cols-2 gap-1">
                            {topics.map((t) => {
                              const checked = topicIds.has(t.id);
                              return (
                                <button
                                  key={t.id}
                                  onClick={() =>
                                    setTopicIds((prev) => {
                                      const n = new Set(prev);
                                      n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                                      return n;
                                    })
                                  }
                                  disabled={isBusy}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted/60 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                  style={checked ? { background: "hsl(262,60%,94%)" } : {}}
                                >
                                  <div
                                    className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all"
                                    style={checked
                                      ? { background: "hsl(262,50%,55%)", borderColor: "hsl(262,50%,55%)" }
                                      : { borderColor: "#D1D5DB" }
                                    }
                                  >
                                    {checked && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="text-xs text-foreground leading-tight">{t.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-red-50 border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{uploadError}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700">Image uploaded and saved to library.</p>
            </div>
          )}

          <div className="mt-auto pt-1 flex items-center gap-3">
            <Button
              onClick={() => upload()}
              disabled={!dataUri || isBusy}
              size="sm"
              className="gap-2 text-sm cursor-pointer"
              style={{ background: "hsl(243,75%,59%)", color: "white" }}
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isUploading ? "Uploading…" : "Upload to Library"}
            </Button>
            {!aiDetected && dataUri && !isAnalyzing && (
              <p className="text-[11px] text-muted-foreground">AI will verify tags on upload.</p>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ── Annotate Modal ────────────────────────────────────────────────────────────

interface AnnotateDetection {
  label: string;
  score: number;
  box: { x: number; y: number; width: number; height: number };
  /** Polygon vertices in normalized [0,1] coordinates. When present, `box` is
   *  the axis-aligned bounding rect of the polygon (used for dedup / mastery). */
  points?: [number, number][];
  source?: string;
}

const BOX_COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16",
];

function parseDetections(item: LibraryItem): AnnotateDetection[] {
  const dr = item.detectionResults as { detections?: unknown[] } | null;
  if (!dr?.detections || !Array.isArray(dr.detections)) return [];
  return dr.detections.filter((d): d is AnnotateDetection =>
    typeof (d as AnnotateDetection).label === "string" &&
    typeof (d as AnnotateDetection).box === "object",
  );
}

function parseVisionTags(item: LibraryItem): string[] {
  const dr = item.detectionResults as { visionTags?: unknown } | null;
  if (!Array.isArray(dr?.visionTags)) return [];
  return [...new Set(
    dr.visionTags
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().toLowerCase()),
  )];
}

type AnnotateModalProps =
  | { mode: "library"; item: LibraryItem; onClose: () => void; onSaved: () => void; suggestedLabels?: string[] }
  | { mode: "upload"; imageUrl: string; initialDetections: AnnotateDetection[]; suggestedLabels?: string[]; onClose: () => void; onSaved: (detections: AnnotateDetection[]) => void };

function AnnotateModal(props: AnnotateModalProps) {
  const initialBoxes = props.mode === "library" ? parseDetections(props.item) : props.initialDetections;
  const imgSrc       = props.mode === "library"
    ? (props.item.imageUrl ?? props.item.mediumUrl ?? props.item.thumbnailUrl ?? "")
    : props.imageUrl;

  const [boxes, setBoxes]             = useState<AnnotateDetection[]>(initialBoxes);
  const [drawMode, setDrawMode]         = useState<"rect" | "polygon">("rect");
  const [drawStart, setDrawStart]       = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent]   = useState<{ x: number; y: number } | null>(null);
  const [pendingBox, setPendingBox]     = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  // Polygon draw state
  const [polyPoints, setPolyPoints]               = useState<[number, number][]>([]);
  const [polyHoverPt, setPolyHoverPt]             = useState<{ x: number; y: number } | null>(null);
  const [pendingPolyPoints, setPendingPolyPoints] = useState<[number, number][] | null>(null);
  const [dragVertex, setDragVertex]               = useState<{
    boxIdx: number; ptIdx: number;
    startPt: { x: number; y: number };
    origPoints: [number, number][];
  } | null>(null);
  const [dragBox, setDragBox]         = useState<{
    idx: number;
    startPt: { x: number; y: number };
    origBox: AnnotateDetection["box"];
    origPoints?: [number, number][]; // present for polygon boxes
  } | null>(null);
  const [hoveredIdx, setHoveredIdx]   = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const unusedSuggestions = props.suggestedLabels ?? [];

  // ── Polygon helpers ──────────────────────────────────────────────────────────
  function polyToBox(pts: [number, number][]): { x: number; y: number; width: number; height: number } {
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  function ptDist(a: [number, number], b: [number, number]) {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
  }
  function closePoly(pts: [number, number][]) {
    const box = polyToBox(pts);
    setPendingBox(box);
    setPendingPolyPoints([...pts]);
    setPolyPoints([]);
    setPolyHoverPt(null);
  }

  const { mutate: saveToApi, isPending: saving, isError: saveError } = useMutation({
    mutationFn: () =>
      props.mode === "library"
        ? apiRequest(`/api/admin/library/${props.item.id}/detections`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detections: boxes }),
          })
        : Promise.resolve(),
    onSuccess: () => {
      if (props.mode === "library") { props.onSaved(); props.onClose(); }
    },
  });

  function handleSave() {
    if (props.mode === "upload") {
      props.onSaved(boxes);
      props.onClose();
    } else {
      saveToApi();
    }
  }

  useEffect(() => {
    if (pendingBox) setTimeout(() => labelInputRef.current?.focus(), 50);
  }, [pendingBox]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pendingBox) { setPendingBox(null); setPendingPolyPoints(null); return; }
        if (polyPoints.length > 0) { setPolyPoints([]); setPolyHoverPt(null); return; }
        props.onClose();
      }
      if (e.key === "Enter" && drawMode === "polygon" && polyPoints.length >= 3 && !pendingBox) {
        closePoly(polyPoints);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onClose, polyPoints, drawMode, pendingBox]);

  function getRelative(e: React.MouseEvent): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onBoxMouseDown(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    e.preventDefault();
    const pt = getRelative(e);
    const det = boxes[i];
    setDragBox({
      idx: i,
      startPt: pt,
      origBox: { ...det.box },
      origPoints: det.points ? det.points.map(p => [p[0], p[1]] as [number, number]) : undefined,
    });
  }

  function onMouseDown(e: React.MouseEvent) {
    if (pendingBox || dragBox || dragVertex) return;
    if (drawMode === "polygon") return; // polygon uses onClick
    e.preventDefault();
    const pt = getRelative(e);
    setDrawStart(pt);
    setDrawCurrent(pt);
  }
  function onMouseMove(e: React.MouseEvent) {
    // Vertex drag (polygon corner handle)
    if (dragVertex) {
      const pt = getRelative(e);
      const dx = pt.x - dragVertex.startPt.x;
      const dy = pt.y - dragVertex.startPt.y;
      setBoxes(prev => prev.map((b, i) => {
        if (i !== dragVertex.boxIdx || !b.points) return b;
        const newPts: [number, number][] = b.points.map((p, j) =>
          j === dragVertex.ptIdx
            ? [
                Math.max(0, Math.min(1, dragVertex.origPoints[j][0] + dx)),
                Math.max(0, Math.min(1, dragVertex.origPoints[j][1] + dy)),
              ]
            : p,
        );
        return { ...b, points: newPts, box: polyToBox(newPts) };
      }));
      return;
    }
    // Box drag (rectangle or polygon whole-shape move)
    if (dragBox) {
      const pt = getRelative(e);
      const dx = pt.x - dragBox.startPt.x;
      const dy = pt.y - dragBox.startPt.y;
      const o  = dragBox.origBox;
      setBoxes(prev => prev.map((b, i) => {
        if (i !== dragBox.idx) return b;
        if (dragBox.origPoints) {
          // Polygon: translate every vertex, recompute bounding rect
          const newPts: [number, number][] = dragBox.origPoints.map(
            ([px, py]) => [Math.max(0, Math.min(1, px + dx)), Math.max(0, Math.min(1, py + dy))],
          );
          return { ...b, points: newPts, box: polyToBox(newPts) };
        }
        // Rectangle: just move x/y
        const nx = Math.max(0, Math.min(1 - o.width,  o.x + dx));
        const ny = Math.max(0, Math.min(1 - o.height, o.y + dy));
        return { ...b, box: { ...o, x: nx, y: ny } };
      }));
      return;
    }
    // Polygon in-progress hover line
    if (drawMode === "polygon") {
      setPolyHoverPt(getRelative(e));
      return;
    }
    if (!drawStart) return;
    setDrawCurrent(getRelative(e));
  }
  function onMouseUp(e: React.MouseEvent) {
    if (dragVertex) { setDragVertex(null); return; }
    if (dragBox) { setDragBox(null); return; }
    if (!drawStart || !drawCurrent) return;
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width  = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);
    setDrawStart(null);
    setDrawCurrent(null);
    if (width > 0.02 && height > 0.02) {
      setPendingBox({ x, y, width, height });
      // Keep pendingLabel so a pre-selected tag can be used on this box.
    }
  }
  /** Click handler — only active in polygon mode */
  function onImageClick(e: React.MouseEvent) {
    if (drawMode !== "polygon" || pendingBox || dragBox || dragVertex) return;
    e.preventDefault();
    const pt = getRelative(e);
    if (polyPoints.length >= 3 && ptDist([pt.x, pt.y], polyPoints[0]) < 0.04) {
      closePoly(polyPoints);
      return;
    }
    setPolyPoints(prev => [...prev, [pt.x, pt.y] as [number, number]]);
  }

  function confirmNewBox() {
    if (!pendingBox || !pendingLabel.trim()) return;
    setBoxes((prev) => [
      ...prev,
      {
        label: pendingLabel.trim(),
        score: 1.0,
        box: pendingBox,
        ...(pendingPolyPoints ? { points: pendingPolyPoints } : {}),
        source: "manual",
      },
    ]);
    setPendingBox(null);
    setPendingPolyPoints(null);
    // Keep pendingLabel so the same tag can be boxed again (e.g. two ribosomes).
  }

  function deleteBox(i: number) {
    setBoxes((prev) => prev.filter((_, idx) => idx !== i));
  }

  const drawRect = drawStart && drawCurrent
    ? {
        x: Math.min(drawStart.x, drawCurrent.x),
        y: Math.min(drawStart.y, drawCurrent.y),
        width:  Math.abs(drawCurrent.x - drawStart.x),
        height: Math.abs(drawCurrent.y - drawStart.y),
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-col w-full h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground">Annotate Bounding Boxes</h2>
              {props.mode === "library" && (
                <p className="text-xs text-muted-foreground truncate max-w-sm">
                  {(props.item as any).topic || (props.item as any).s3Key || ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveError && <span className="text-xs text-red-500 font-medium">Save failed — try again</span>}
            <button
              onClick={props.onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hint bar */}
        <div className="flex items-center gap-3 px-5 py-2 bg-muted/40 border-b border-border/50 shrink-0 text-[11px] text-muted-foreground flex-wrap">
          {/* Tool switcher */}
          <div className="flex items-center gap-0.5 bg-muted border border-border rounded-lg p-0.5 shrink-0">
            <button
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${drawMode === "rect" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setDrawMode("rect"); setPolyPoints([]); setPolyHoverPt(null); }}
            >
              Rectangle
            </button>
            <button
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${drawMode === "polygon" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setDrawMode("polygon"); setDrawStart(null); setDrawCurrent(null); }}
            >
              Polygon
            </button>
          </div>
          <span className="opacity-40">·</span>
          {drawMode === "rect" ? (
            <>
              <span><strong className="text-foreground">Draw:</strong> drag on image</span>
              <span className="opacity-40">·</span>
              <span><strong className="text-foreground">Move:</strong> drag a box label</span>
            </>
          ) : (
            <>
              <span><strong className="text-foreground">Click</strong> to place points — <strong className="text-foreground">click the first point</strong> (or press <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↵</kbd>) to close shape</span>
              {polyPoints.length >= 3 && (
                <span className="text-indigo-500 font-semibold">{polyPoints.length} points placed</span>
              )}
            </>
          )}
          <span className="opacity-40">·</span>
          <span><strong className="text-foreground">Delete:</strong> × on label</span>
          <span className="opacity-40">·</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Esc</kbd> to cancel</span>
        </div>

        <div className="shrink-0 border-b border-border bg-card px-5 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
              {pendingBox
                ? "Box drawn — click a label (repeats allowed), then Add."
                : "Click a label, draw a box on the image, then Add. Same label can be used more than once."}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {unusedSuggestions.map((t) => {
                const selected = pendingLabel.trim().toLowerCase() === t.toLowerCase();
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPendingLabel(t)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer"
                    style={selected
                      ? { background: "hsl(243,75%,59%)", color: "white", borderColor: "hsl(243,75%,59%)" }
                      : { background: "hsl(32,90%,94%)", color: "hsl(32,60%,35%)", borderColor: "hsl(32,70%,80%)" }
                    }
                  >
                    {t}
                  </button>
                );
              })}
              <input
                ref={labelInputRef}
                value={pendingLabel}
                onChange={(e) => setPendingLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmNewBox();
                }}
                placeholder="Or type a custom label"
                className="min-w-[140px] flex-1 max-w-xs text-xs px-2.5 py-1 rounded-md border border-border bg-background outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={confirmNewBox}
            disabled={!pendingBox || !pendingLabel.trim()}
            className="shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-sm"
            style={{ background: "hsl(243,75%,59%)" }}
          >
            Add
          </button>
        </div>

        {/* Main — canvas + sidebar */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Canvas */}
          <div className="flex-1 min-h-0 w-full overflow-hidden p-4 flex items-center justify-center bg-muted/10">
            <div
              ref={containerRef}
              className="relative select-none shadow-xl rounded-xl leading-none"
              style={{
                cursor: dragVertex ? "grabbing" : dragBox ? "grabbing" : pendingBox ? "default" : "crosshair",
                maxHeight: "100%",
                maxWidth: "100%",
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={(e) => { onMouseUp(e); setPolyHoverPt(null); }}
              onClick={onImageClick}
            >
              <img
                src={imgSrc}
                alt="annotate"
                className="block rounded-xl object-contain mx-auto"
                style={{ maxHeight: "calc(100vh - 16.5rem)", maxWidth: "100%", height: "auto" }}
                draggable={false}
              />

            {/* SVG overlay — decorative shapes + polygon vertex handles */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {boxes.map((det, i) => {
                const color = BOX_COLORS[i % BOX_COLORS.length];
                const isDraggingThis = dragBox?.idx === i || dragVertex?.boxIdx === i;
                const isHighlighted  = hoveredIdx === i || isDraggingThis;
                if (det.points && det.points.length >= 3) {
                  // Only the polygon fill/stroke goes in SVG; vertex handles are
                  // rendered as <div>s below to avoid oval distortion from preserveAspectRatio="none"
                  return (
                    <polygon
                      key={i}
                      points={det.points.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill={isHighlighted ? `${color}50` : `${color}20`}
                      stroke={color}
                      strokeWidth={isHighlighted ? "0.007" : "0.004"}
                    />
                  );
                }
                return (
                  <rect
                    key={i}
                    x={det.box.x} y={det.box.y}
                    width={det.box.width} height={det.box.height}
                    fill={isHighlighted ? `${color}50` : `${color}20`}
                    stroke={color}
                    strokeWidth={isHighlighted ? "0.007" : "0.004"}
                  />
                );
              })}

              {/* In-progress rectangle */}
              {drawRect && (
                <rect
                  x={drawRect.x} y={drawRect.y}
                  width={drawRect.width} height={drawRect.height}
                  fill="rgba(99,102,241,0.12)"
                  stroke="#6366f1"
                  strokeWidth="0.004"
                  strokeDasharray="0.02 0.01"
                />
              )}

              {/* In-progress polygon — lines + fill only; vertex dots rendered as divs below */}
              {drawMode === "polygon" && polyPoints.length > 0 && (() => {
                const hover = polyHoverPt;
                const allPts: [number, number][] = hover
                  ? [...polyPoints, [hover.x, hover.y]]
                  : polyPoints;
                return (
                  <g>
                    {polyPoints.length >= 3 && (
                      <polygon
                        points={polyPoints.map(([x, y]) => `${x},${y}`).join(" ")}
                        fill="rgba(99,102,241,0.10)"
                        stroke="none"
                      />
                    )}
                    <polyline
                      points={allPts.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="0.004"
                      strokeDasharray="0.02 0.01"
                    />
                  </g>
                );
              })()}

              {/* Pending outline — polygon shape when drawn by polygon tool, rect otherwise */}
              {pendingBox && (
                pendingPolyPoints && pendingPolyPoints.length >= 3
                  ? <polygon
                      points={pendingPolyPoints.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill="rgba(99,102,241,0.15)"
                      stroke="#6366f1"
                      strokeWidth="0.005"
                      strokeDasharray="0.02 0.01"
                    />
                  : <rect
                      x={pendingBox.x} y={pendingBox.y}
                      width={pendingBox.width} height={pendingBox.height}
                      fill="rgba(99,102,241,0.15)"
                      stroke="#6366f1"
                      strokeWidth="0.005"
                      strokeDasharray="0.02 0.01"
                    />
              )}
            </svg>

            {/* Hover-detection areas — full bounding box area for rect; for polygon
                a transparent SVG clip-path version would be ideal but bounding rect
                is fine for hover. Drag is initiated from the label chip. */}
            {boxes.map((det, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left:   `${det.box.x * 100}%`,
                  top:    `${det.box.y * 100}%`,
                  width:  `${det.box.width * 100}%`,
                  height: `${det.box.height * 100}%`,
                  zIndex: 8,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}

            {/* Polygon vertex drag handles — rendered as divs (not SVG circles) so
                they stay perfectly round regardless of image aspect ratio. */}
            {boxes.map((det, i) =>
              det.points?.map(([vx, vy], j) => {
                const color = BOX_COLORS[i % BOX_COLORS.length];
                const isActive = dragVertex?.boxIdx === i && dragVertex?.ptIdx === j;
                return (
                  <div
                    key={`v-${i}-${j}`}
                    className="absolute rounded-full border-2 shadow"
                    style={{
                      left:      `${vx * 100}%`,
                      top:       `${vy * 100}%`,
                      width:     12,
                      height:    12,
                      transform: "translate(-50%, -50%)",
                      borderColor: color,
                      background: isActive ? color : "white",
                      cursor:    dragVertex ? "grabbing" : "grab",
                      zIndex:    16,
                      pointerEvents: "auto",
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragVertex({
                        boxIdx: i,
                        ptIdx: j,
                        startPt: getRelative(e),
                        origPoints: det.points!,
                      });
                    }}
                  />
                );
              })
            )}

            {/* In-progress polygon vertex dots — also divs for the same reason */}
            {drawMode === "polygon" && (() => {
              const closable = polyPoints.length >= 3 && polyHoverPt &&
                ptDist([polyHoverPt.x, polyHoverPt.y], polyPoints[0]) < 0.04;
              return polyPoints.map(([x, y], j) => (
                <div
                  key={`ip-${j}`}
                  className="absolute rounded-full border-2 shadow pointer-events-none"
                  style={{
                    left:      `${x * 100}%`,
                    top:       `${y * 100}%`,
                    width:     j === 0 ? 14 : 10,
                    height:    j === 0 ? 14 : 10,
                    transform: "translate(-50%, -50%)",
                    background: j === 0 ? (closable ? "#10b981" : "#6366f1") : "white",
                    borderColor: "#6366f1",
                    zIndex: 17,
                  }}
                />
              ));
            })()}

            {/* Box labels */}
            {boxes.map((det, i) => {
              const color          = BOX_COLORS[i % BOX_COLORS.length];
              const isDraggingThis = dragBox?.idx === i;
              const isHighlighted  = hoveredIdx === i || isDraggingThis;
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: `${det.box.x * 100}%`,
                    top:  `${det.box.y * 100}%`,
                    pointerEvents: "auto",
                    zIndex: isDraggingThis ? 20 : 12,
                  }}
                >
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-white shadow-md transition-all m-1"
                    style={{
                      background: color,
                      whiteSpace: "nowrap",
                      cursor: isDraggingThis ? "grabbing" : "grab",
                      opacity: 1,
                      transform: isHighlighted ? "scale(1.05)" : "scale(1)",
                    }}
                    onMouseDown={(e) => onBoxMouseDown(e, i)}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingLabel(det.label);
                    }}
                  >
                    {det.label}
                    {det.score < 1 && (
                      <span className="opacity-75 font-normal text-[10px] ml-0.5">
                        {Math.round(det.score * 100)}%
                      </span>
                    )}
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); deleteBox(i); }}
                      className="ml-0.5 hover:opacity-70 cursor-pointer transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

          {/* ── Sidebar — box list ────────────────────────────────────────── */}
          <div className="w-72 shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">

            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-border/60 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">Labels</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {boxes.length} box{boxes.length !== 1 ? "es" : ""}
              </span>
            </div>

            {/* Unused vision labels — draw a box then click one of these */}
            {unusedSuggestions.length > 0 && (
              <div className="px-4 py-2.5 border-b border-border/60 bg-amber-50/80">
                <p className="text-[10px] font-medium text-amber-900 mb-1.5">
                  Vision labels (tap to select — repeats allowed)
                </p>
                <div className="flex flex-wrap gap-1">
                  {unusedSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPendingLabel(t)}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {boxes.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <PenLine className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">No boxes yet</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Drag on the image to draw a bounding box, then give it a label.
                  </p>
                </div>
              </div>
            )}

            {/* Box rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {boxes.map((det, i) => {
                const color       = BOX_COLORS[i % BOX_COLORS.length];
                const isHighlighted = hoveredIdx === i;
                const pct         = Math.round(det.score * 100);
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors cursor-default ${
                      isHighlighted ? "bg-muted/70" : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Color swatch */}
                    <div
                      className="w-3 h-3 rounded shrink-0 ring-1 ring-black/10"
                      style={{ background: color }}
                    />
                    {/* Label */}
                    <span className="flex-1 text-xs font-medium text-foreground truncate" title={det.label}>
                      {det.label}
                    </span>
                    {/* Score */}
                    {det.score < 1 && (
                      <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-full ${
                        pct >= 70 ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                        : pct >= 40 ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                      }`}>
                        {pct}%
                      </span>
                    )}
                    {/* Delete */}
                    <button
                      onClick={() => deleteBox(i)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                      title={`Remove "${det.label}"`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Save button */}
            <div className="shrink-0 border-t border-border p-4">
              {saveError && (
                <p className="text-xs text-red-500 font-medium mb-2">Save failed — try again</p>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60 cursor-pointer"
                style={{ background: "hsl(243,75%,59%)" }}
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Check className="w-4 h-4" /> Save changes</>
                }
              </button>
            </div>
          </div>

        </div>{/* end main flex row */}
      </div>
    </div>
  );
}

// ── Edit metadata modal ───────────────────────────────────────────────────────
// Lightweight modal for editing subject + imageConcept on an existing library image.

function EditMetadataModal({
  item,
  onClose,
  onSaved,
}: {
  item: LibraryItem;
  onClose: () => void;
  onSaved: (imageConcept: string | null) => void;
}) {
  const [imageConcept, setImageConcept] = useState(item.imageConcept ?? "");
  const [error, setError]               = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiRequest<{ updated: boolean; imageConcept: string | null }>(
        `/api/admin/library/${item.id}/metadata`,
        {
          method: "PUT",
          body: JSON.stringify({ imageConcept: imageConcept.trim() || null }),
        }
      ),
    onSuccess: (data) => {
      onSaved(data.imageConcept);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Save failed");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(262,60%,94%)" }}>
              <BookOpen className="w-3.5 h-3.5" style={{ color: "hsl(262,50%,45%)" }} />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Edit Labels</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Describe the specific concept this image depicts. Claude uses this to anchor its passage — be precise (e.g. "DNA replication", "Covered wagons crossing the plains").
        </p>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            Concept
          </label>
          <Input
            value={imageConcept}
            onChange={(e) => setImageConcept(e.target.value)}
            placeholder="e.g. Chromosomes, Westward Expansion…"
            disabled={isPending}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") mutate(); }}
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => mutate()}
            disabled={isPending}
            size="sm"
            className="flex-1 gap-1.5 cursor-pointer"
            style={{ background: "hsl(262,50%,55%)", color: "white" }}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending} className="cursor-pointer">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteButton({ id, s3Key, onDeleted }: { id: string; s3Key: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: () => apiRequest(`/api/admin/library/${id}`, { method: "DELETE" }),
    onSuccess: onDeleted,
  });

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button onClick={() => setConfirm(false)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
      title={`Delete ${s3Key}`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────

function ImageCard({
  item,
  onTopics,
  onAnnotate,
  onEditMeta,
  onDeleted,
  bulkMode = false,
  selected = false,
  onSelect,
}: {
  item: LibraryItem;
  onTopics: () => void;
  onAnnotate: () => void;
  onEditMeta: () => void;
  onDeleted: () => void;
  bulkMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const filename = item.s3Key.split("/").pop() ?? item.s3Key;
  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  const hasLabels = !!item.imageConcept;

  return (
    <div
      className="group bg-card border rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      style={{
        borderColor: selected ? "hsl(243,75%,59%)" : "hsl(var(--border))",
        boxShadow: selected ? "0 0 0 2px hsl(243,75%,59%,0.25)" : undefined,
        cursor: bulkMode ? "pointer" : undefined,
      }}
      onClick={bulkMode ? onSelect : undefined}
    >
      {/* Thumbnail — use 200px thumbnail when available, fall back to original */}
      <div className="relative bg-muted" style={{ aspectRatio: "4/3" }}>
        {(item.thumbnailUrl ?? item.imageUrl) ? (
          <img
            src={(item.thumbnailUrl ?? item.imageUrl)!}
            alt={filename}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (item.thumbnailUrl && img.src === item.thumbnailUrl && item.imageUrl) {
                img.src = item.imageUrl;
              } else {
                img.style.display = "none";
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground/20" />
          </div>
        )}

        {/* Bulk-mode selection overlay */}
        {bulkMode ? (
          <div
            className="absolute inset-0 transition-colors"
            style={{ background: selected ? "hsl(243,75%,59%,0.18)" : "transparent" }}
          >
            <div className="absolute top-2 left-2">
              {selected
                ? <SquareCheck className="w-5 h-5 drop-shadow" style={{ color: "hsl(243,75%,59%)" }} />
                : <Square className="w-5 h-5 text-white drop-shadow opacity-80" />
              }
            </div>
          </div>
        ) : (
          <>
            {/* Normal hover overlay + action buttons */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                onClick={onEditMeta}
                title="Edit concept label"
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-muted-foreground hover:text-violet-600 hover:bg-white transition-colors cursor-pointer shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onAnnotate}
                title="Edit bounding boxes"
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-muted-foreground hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer shadow-sm"
              >
                <PenLine className="w-3.5 h-3.5" />
              </button>
              <DeleteButton id={item.id} s3Key={item.s3Key} onDeleted={onDeleted} />
            </div>
          </>
        )}
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
        {/* Filename */}
        <p className="text-xs font-medium text-foreground truncate leading-snug" title={filename}>
          {filename}
        </p>

        {/* Concept label — the AI anchors its passage to this */}
        {hasLabels ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none w-fit"
            style={{ background: "hsl(32,90%,94%)", color: "hsl(32,60%,35%)" }}
          >
            <Crosshair className="w-2.5 h-2.5" />
            {item.imageConcept}
          </span>
        ) : (
          !bulkMode && (
            <button
              onClick={onEditMeta}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-amber-600 transition-colors cursor-pointer w-fit"
            >
              <Crosshair className="w-2.5 h-2.5" />
              Add concept
            </button>
          )
        )}

        {/* Description */}
        {item.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed" title={item.description}>
            {item.description}
          </p>
        )}

        {/* Tags */}
        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
                style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}
              >
                {t}
              </span>
            ))}
            {item.tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground/60 self-center">
                +{item.tags.length - 4}
              </span>
            )}
          </div>
        ) : null}

        {/* Footer row: topics + date (hidden in bulk mode to keep card clean) */}
        {!bulkMode && (
          <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border/50">
            <button
              onClick={onTopics}
              title="Manage topics"
              className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer group/tp"
              style={item.topicCount > 0
                ? { color: "hsl(243,75%,49%)" }
                : { color: "hsl(0,0%,60%)" }
              }
            >
              <Layers className="w-3 h-3" />
              {item.topicCount > 0 ? `${item.topicCount} topic${item.topicCount !== 1 ? "s" : ""}` : "Add topics"}
            </button>
            <span className="text-[10px] text-muted-foreground/50 shrink-0">{date}</span>
          </div>
        )}
        {bulkMode && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {(item.contexts ?? []).length > 0
              ? (item.contexts ?? []).map((c) => {
                  const opt = CONTEXT_OPTIONS.find((o) => o.value === c);
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
                      style={{ background: "hsl(142,60%,92%)", color: "hsl(142,50%,32%)" }}
                    >
                      {opt?.label ?? c}
                    </span>
                  );
                })
              : <span className="text-[10px] text-muted-foreground/40 italic">No context</span>
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pagination bar ─────────────────────────────────────────────────────────────

function PaginationBar({
  currentPage,
  totalPages,
  offset,
  total,
  pageLimit,
  onPrev,
  onNext,
  onPage,
}: {
  currentPage: number;
  totalPages: number;
  offset: number;
  total: number;
  pageLimit: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (page: number) => void;
}) {
  // Build visible page numbers: always show first, last, current ±1, with ellipsis
  function pageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    const lo = Math.max(2, currentPage - 1);
    const hi = Math.min(totalPages - 1, currentPage + 1);
    if (lo > 2) pages.push("…");
    for (let i = lo; i <= hi; i++) pages.push(i);
    if (hi < totalPages - 1) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  const from = total === 0 ? 0 : offset + 1;
  const to   = Math.min(offset + pageLimit, total);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-muted-foreground">
        {total === 0 ? "No images" : `${from}–${to} of ${total.toLocaleString()} images`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {pageNumbers().map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="w-7 text-center text-xs text-muted-foreground select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors cursor-pointer"
                style={
                  p === currentPage
                    ? { background: "hsl(243,75%,59%)", color: "white" }
                    : { color: "hsl(0,0%,40%)" }
                }
                onMouseEnter={(e) => {
                  if (p !== currentPage) (e.currentTarget as HTMLButtonElement).style.background = "hsl(0,0%,95%)";
                }}
                onMouseLeave={(e) => {
                  if (p !== currentPage) (e.currentTarget as HTMLButtonElement).style.background = "";
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={onNext}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground disabled:opacity-30 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 24;

export default function AdminLibrary() {
  const [offset, setOffset]                   = useState(0);
  const [topicsModalItem, setTopicsModalItem] = useState<LibraryItem | null>(null);
  const [annotateItem, setAnnotateItem]       = useState<LibraryItem | null>(null);
  const [editMetaItem, setEditMetaItem]       = useState<LibraryItem | null>(null);

  // Bulk-assign context state
  const [bulkMode, setBulkMode]         = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkContexts, setBulkContexts] = useState<Set<string>>(new Set());
  const [bulkSuccess, setBulkSuccess]   = useState(false);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery<LibraryResponse>({
    queryKey: ["admin-library", offset],
    queryFn: () => apiRequest(`/api/admin/library?limit=${PAGE_LIMIT}&offset=${offset}`),
  });

  const totalPages  = data ? Math.ceil(data.total / PAGE_LIMIT) : 1;
  const currentPage = Math.floor(offset / PAGE_LIMIT) + 1;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-library"] });
  }

  function goToPage(page: number) {
    setOffset((page - 1) * PAGE_LIMIT);
  }

  function toggleBulkMode() {
    setBulkMode((v) => !v);
    setSelectedIds(new Set());
    setBulkContexts(new Set());
    setBulkSuccess(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set((data?.items ?? []).map((i) => i.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Apply contexts mutation — fires one request per selected image
  const { mutate: applyContexts, isPending: applying } = useMutation({
    mutationFn: async () => {
      const contexts = Array.from(bulkContexts);
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          apiRequest(`/api/admin/library/${id}/contexts`, {
            method: "PUT",
            body: JSON.stringify({ contexts }),
          })
        )
      );
    },
    onSuccess: () => {
      refresh();
      setSelectedIds(new Set());
      setBulkSuccess(true);
      setTimeout(() => setBulkSuccess(false), 3000);
    },
  });

  return (
    <AdminLayout
      title="Image Library"
      subtitle="Upload and manage images stored in AWS S3."
    >
      {topicsModalItem && (
        <ManageTopicsModal
          item={topicsModalItem}
          onClose={() => setTopicsModalItem(null)}
          onSaved={refresh}
        />
      )}

      {annotateItem && (
        <AnnotateModal
          mode="library"
          item={annotateItem}
          suggestedLabels={parseVisionTags(annotateItem)}
          onClose={() => setAnnotateItem(null)}
          onSaved={refresh}
        />
      )}

      {editMetaItem && (
        <EditMetadataModal
          item={editMetaItem}
          onClose={() => setEditMetaItem(null)}
          onSaved={(imageConcept) => {
            // Optimistically update the cached item so the badge appears instantly
            // without a full refetch, then trigger a background refresh.
            qc.setQueryData<LibraryResponse>(["admin-library", offset], (old) => {
              if (!old) return old;
              return {
                ...old,
                items: old.items.map((i) =>
                  i.id === editMetaItem.id ? { ...i, imageConcept } : i
                ),
              };
            });
            refresh();
          }}
        />
      )}

      <div className="space-y-6">
        <UploadPanel onSuccess={refresh} />

        {/* Library grid */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5 flex-wrap">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "hsl(243,75%,59%,0.10)" }}>
              <ImageIcon className="w-3.5 h-3.5" style={{ color: "hsl(243,75%,49%)" }} />
            </div>
            <h3 className="text-sm font-semibold text-foreground flex-1">Library</h3>
            {data && (
              <span className="text-xs font-medium rounded-full px-2 py-0.5"
                style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                {data.total.toLocaleString()} image{data.total !== 1 ? "s" : ""}
              </span>
            )}
            {/* Bulk mode toggle */}
            {data && data.total > 0 && (
              <button
                onClick={toggleBulkMode}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer"
                style={bulkMode
                  ? { background: "hsl(243,75%,59%)", color: "white", borderColor: "hsl(243,75%,49%)" }
                  : { background: "white", color: "#374151", borderColor: "#E5E7EB" }
                }
              >
                <SquareCheck className="w-3.5 h-3.5" />
                {bulkMode ? "Exit bulk mode" : "Bulk assign context"}
              </button>
            )}
          </div>

          {/* Bulk mode toolbar — shown between header and grid */}
          {bulkMode && (
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3">
              {/* Selection controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={selectAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Select all ({data?.items.length ?? 0})
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              <span className="text-muted-foreground/30">|</span>

              {/* Context checkboxes */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">Assign:</span>
                {CONTEXT_OPTIONS.map((opt) => {
                  const checked = bulkContexts.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setBulkContexts((prev) => {
                        const n = new Set(prev);
                        n.has(opt.value) ? n.delete(opt.value) : n.add(opt.value);
                        return n;
                      })}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all cursor-pointer"
                      style={checked
                        ? { background: "hsl(243,75%,59%,0.12)", borderColor: "hsl(243,75%,59%,0.5)", color: "hsl(243,75%,39%)" }
                        : { background: "white", borderColor: "#E5E7EB", color: "#4B5563" }
                      }
                    >
                      <div
                        className="w-3 h-3 rounded flex items-center justify-center shrink-0 border transition-all"
                        style={checked
                          ? { background: "hsl(243,75%,59%)", borderColor: "hsl(243,75%,59%)" }
                          : { borderColor: "#D1D5DB" }
                        }
                      >
                        {checked && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                      </div>
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                {bulkSuccess && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Applied!
                  </span>
                )}
                <Button
                  size="sm"
                  disabled={selectedIds.size === 0 || bulkContexts.size === 0 || applying}
                  onClick={() => applyContexts()}
                  className="gap-1.5 text-xs cursor-pointer disabled:cursor-not-allowed"
                  style={{ background: "hsl(243,75%,59%)", color: "white" }}
                >
                  {applying
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
                    : <><ListChecks className="w-3.5 h-3.5" /> Apply to {selectedIds.size > 0 ? selectedIds.size : "selected"}</>
                  }
                </Button>
              </div>
            </div>
          )}

          <div className="p-5">
            {isLoading ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
                    <div className="bg-muted" style={{ aspectRatio: "4/3" }} />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !data?.items.length ? (
              <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <ImageIcon className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium">No images yet</p>
                <p className="text-xs opacity-60">Upload one above to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {data.items.map((item) => (
                  <ImageCard
                    key={item.id}
                    item={item}
                    onTopics={() => setTopicsModalItem(item)}
                    onAnnotate={() => setAnnotateItem(item)}
                    onEditMeta={() => setEditMetaItem(item)}
                    onDeleted={refresh}
                    bulkMode={bulkMode}
                    selected={selectedIds.has(item.id)}
                    onSelect={() => toggleSelect(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination — always shown when there's data */}
          {data && data.total > 0 && (
            <div className="px-5 py-3.5 border-t border-border">
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                offset={offset}
                total={data.total}
                pageLimit={PAGE_LIMIT}
                onPrev={() => setOffset((o) => Math.max(0, o - PAGE_LIMIT))}
                onNext={() => setOffset((o) => o + PAGE_LIMIT)}
                onPage={goToPage}
              />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

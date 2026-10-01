import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin-layout";
import { apiRequest, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Plus, Pencil, Trash2, X, Loader2,
  ImageIcon, AlertCircle, CheckCircle2, Check, BookOpen,
  Users, Heart, Cloud, Wifi, Tag, ChevronLeft, ChevronRight as ChevronRightIcon,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContentCategory {
  id: string; name: string; slug: string; description: string | null;
  displayOrder: number; isActive: boolean; createdAt: string; topicCount: number;
}
interface Topic {
  id: string; contentCategoryId: string; name: string; slug: string;
  description: string | null; displayOrder: number; isActive: boolean;
  createdAt: string; imageCount: number;
}
interface AssignedImage {
  id: string; s3Key: string; contentType: string; sizeBytes: number | null;
  tags: string[]; description: string | null; sortOrder: number;
  addedAt: string; imageUrl: string | null;
}
interface LibraryItem {
  id: string; s3Key: string; tags: string[]; description: string | null;
  imageUrl: string | null; contentType: string; sizeBytes: number | null;
  createdAt: string;
}

// ── Theme visual config ───────────────────────────────────────────────────────

const THEME_COLORS: Record<string, { bg: string; text: string; border: string; icon: React.FC<any> }> = {
  "school-and-learning":         { bg: "hsl(217,91%,60%,0.10)", text: "hsl(217,91%,45%)", border: "hsl(217,91%,60%,0.30)", icon: BookOpen },
  "community-and-neighborhood":  { bg: "hsl(25,95%,53%,0.10)",  text: "hsl(25,95%,40%)",  border: "hsl(25,95%,53%,0.30)",  icon: Users },
  "health-and-well-being":       { bg: "hsl(142,71%,45%,0.10)", text: "hsl(142,71%,32%)", border: "hsl(142,71%,45%,0.30)", icon: Heart },
  "environment-and-weather":     { bg: "hsl(186,100%,42%,0.10)",text: "hsl(186,100%,28%)",border: "hsl(186,100%,42%,0.30)",icon: Cloud },
  "technology-and-communication":{ bg: "hsl(243,75%,59%,0.10)", text: "hsl(243,75%,49%)", border: "hsl(243,75%,59%,0.30)", icon: Wifi },
};

function themeColor(slug: string) {
  return THEME_COLORS[slug] ?? {
    bg: "hsl(243,75%,59%,0.10)", text: "hsl(243,75%,49%)", border: "hsl(243,75%,59%,0.30)", icon: Tag,
  };
}

// ── Small reusable form modal ─────────────────────────────────────────────────

function FormModal({
  title, fields, onSubmit, onClose, isPending, error,
}: {
  title: string;
  fields: { label: string; name: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }[];
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{f.label}</label>
              {f.multiline ? (
                <textarea
                  value={f.value} onChange={(e) => f.onChange(e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder} className="text-sm" />
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-red-50 border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">Cancel</Button>
            <Button size="sm" onClick={onSubmit} disabled={isPending}
              className="gap-2 cursor-pointer" style={{ background: "hsl(243,75%,59%)", color: "white" }}>
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Library picker modal ──────────────────────────────────────────────────────

function LibraryPicker({
  topicId,
  assignedIds,
  onClose,
  onAssigned,
}: {
  topicId: string;
  assignedIds: Set<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: LibraryItem[]; total: number }>({
    queryKey: ["library-picker", offset],
    queryFn: () => apiRequest(`/api/admin/library?limit=16&offset=${offset}`),
  });

  const { mutate: assign, isPending } = useMutation({
    mutationFn: () =>
      apiRequest(`/api/admin/library/topics/${topicId}/images`, {
        method: "POST",
        body: JSON.stringify({ libraryImageIds: [...selected] }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topic-images", topicId] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      onAssigned();
      onClose();
    },
  });

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalPages  = data ? Math.ceil(data.total / 16) : 1;
  const currentPage = Math.floor(offset / 16) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col"
        style={{ maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Assign Images from Library</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Select images to add to this topic</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <ImageIcon className="w-8 h-8 opacity-30" />
              <p className="text-sm">No images in library yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {data.items.map((item) => {
                const isAssigned = assignedIds.has(item.id);
                const isSelected = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => !isAssigned && toggleItem(item.id)}
                    disabled={isAssigned}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer disabled:cursor-default group"
                    style={{
                      borderColor: isAssigned ? "hsl(142,71%,45%)" : isSelected ? "hsl(243,75%,59%)" : "transparent",
                    }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Overlay */}
                    {isAssigned && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                    {isSelected && !isAssigned && (
                      <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "hsl(243,75%,59%)" }}>
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                    {/* Hover overlay for unselected, unassigned */}
                    {!isAssigned && !isSelected && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    )}
                    {/* Tag count */}
                    {item.tags.length > 0 && (
                      <div className="absolute bottom-1 left-1 rounded px-1 py-0.5 text-[9px] font-medium bg-black/50 text-white">
                        {item.tags.length} tags
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border shrink-0 bg-muted/20">
          {/* Pagination */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setOffset((o) => Math.max(0, o - 16))} disabled={offset === 0}
              className="w-7 h-7 flex items-center justify-center rounded border border-border bg-card text-muted-foreground disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground px-1">{currentPage} / {totalPages}</span>
            <button onClick={() => setOffset((o) => o + 16)} disabled={!data || offset + 16 >= data.total}
              className="w-7 h-7 flex items-center justify-center rounded border border-border bg-card text-muted-foreground disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed">
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            {data && <span className="text-xs text-muted-foreground ml-1">{data.total} total</span>}
          </div>

          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <span className="text-xs font-medium" style={{ color: "hsl(243,75%,49%)" }}>
                {selected.size} selected
              </span>
            )}
            <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">Cancel</Button>
            <Button size="sm" onClick={() => assign()} disabled={selected.size === 0 || isPending}
              className="gap-2 cursor-pointer" style={{ background: "hsl(243,75%,59%)", color: "white" }}>
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Assign {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View = "categories" | "topics" | "images";

export default function AdminThemes() {
  const qc = useQueryClient();

  // Navigation state
  const [view, setView]               = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Modal states
  const [categoryModal, setCategoryModal]   = useState<{ mode: "create" | "edit"; category?: ContentCategory } | null>(null);
  const [topicModal, setTopicModal]   = useState<{ mode: "create" | "edit"; topic?: Topic } | null>(null);
  const [showPicker, setShowPicker]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: "category" | "topic"; id: string; name: string } | null>(null);

  // Form fields
  const [formName, setFormName]         = useState("");
  const [formDesc, setFormDesc]         = useState("");
  const [formError, setFormError]       = useState<string | null>(null);

  // Images pagination
  const [imgOffset, setImgOffset]       = useState(0);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<{ contentCategories: ContentCategory[] }>({
    queryKey: ["content-categories"],
    queryFn:  () => apiRequest("/api/admin/library/content-categories"),
  });

  const { data: topicsData, isLoading: topicsLoading } = useQuery<{ topics: Topic[] }>({
    queryKey: ["library-topics", selectedCategory?.id],
    queryFn:  () => apiRequest(`/api/admin/library/content-categories/${selectedCategory!.id}/topics`),
    enabled:  !!selectedCategory,
  });

  const { data: imagesData, isLoading: imagesLoading } = useQuery<{ items: AssignedImage[]; total: number }>({
    queryKey: ["topic-images", selectedTopic?.id, imgOffset],
    queryFn:  () => apiRequest(`/api/admin/library/topics/${selectedTopic!.id}/images?limit=20&offset=${imgOffset}`),
    enabled:  !!selectedTopic,
  });

  const assignedIds = new Set((imagesData?.items ?? []).map((i) => i.id));

  // ── Mutations ────────────────────────────────────────────────────────────────

  function openCategoryCreate() {
    setFormName(""); setFormDesc(""); setFormError(null);
    setCategoryModal({ mode: "create" });
  }
  function openCategoryEdit(category: ContentCategory) {
    setFormName(category.name); setFormDesc(category.description ?? ""); setFormError(null);
    setCategoryModal({ mode: "edit", category });
  }
  function openTopicCreate() {
    setFormName(""); setFormDesc(""); setFormError(null);
    setTopicModal({ mode: "create" });
  }
  function openTopicEdit(topic: Topic) {
    setFormName(topic.name); setFormDesc(topic.description ?? ""); setFormError(null);
    setTopicModal({ mode: "edit", topic });
  }

  const { mutate: saveCategory, isPending: savingCategory } = useMutation({
    mutationFn: () => categoryModal?.mode === "create"
      ? apiRequest("/api/admin/library/content-categories", { method: "POST", body: JSON.stringify({ name: formName, description: formDesc || undefined }) })
      : apiRequest(`/api/admin/library/content-categories/${categoryModal!.category!.id}`, { method: "PATCH", body: JSON.stringify({ name: formName, description: formDesc || undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-categories"] }); setCategoryModal(null); },
    onError:   (err) => setFormError(err instanceof ApiError ? err.message : "Save failed"),
  });

  const { mutate: saveTopic, isPending: savingTopic } = useMutation({
    mutationFn: () => topicModal?.mode === "create"
      ? apiRequest(`/api/admin/library/content-categories/${selectedCategory!.id}/topics`, { method: "POST", body: JSON.stringify({ name: formName, description: formDesc || undefined }) })
      : apiRequest(`/api/admin/library/topics/${topicModal!.topic!.id}`, { method: "PATCH", body: JSON.stringify({ name: formName, description: formDesc || undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library-topics", selectedCategory?.id] }); setTopicModal(null); },
    onError:   (err) => setFormError(err instanceof ApiError ? err.message : "Save failed"),
  });

  const { mutate: confirmDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteConfirm!.kind === "category"
      ? apiRequest(`/api/admin/library/content-categories/${deleteConfirm!.id}`, { method: "DELETE" })
      : apiRequest(`/api/admin/library/topics/${deleteConfirm!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      if (deleteConfirm!.kind === "category") {
        qc.invalidateQueries({ queryKey: ["content-categories"] });
        if (selectedCategory?.id === deleteConfirm!.id) { setSelectedCategory(null); setView("categories"); }
      } else {
        qc.invalidateQueries({ queryKey: ["library-topics", selectedCategory?.id] });
        if (selectedTopic?.id === deleteConfirm!.id) { setSelectedTopic(null); setView("topics"); }
      }
      setDeleteConfirm(null);
    },
  });

  const { mutate: removeImage } = useMutation({
    mutationFn: (libraryId: string) =>
      apiRequest(`/api/admin/library/topics/${selectedTopic!.id}/images/${libraryId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topic-images", selectedTopic?.id] });
      qc.invalidateQueries({ queryKey: ["library-topics", selectedCategory?.id] });
    },
  });

  // ── Navigation helpers ───────────────────────────────────────────────────────

  function selectCategory(category: ContentCategory) {
    setSelectedCategory(category); setSelectedTopic(null); setImgOffset(0); setView("topics");
  }
  function selectTopic(topic: Topic) {
    setSelectedTopic(topic); setImgOffset(0); setView("images");
  }
  function goToCategories() { setView("categories"); setSelectedCategory(null); setSelectedTopic(null); }
  function goToTopics() { setView("topics"); setSelectedTopic(null); setImgOffset(0); }

  const imgTotalPages  = imagesData ? Math.ceil(imagesData.total / 20) : 1;
  const imgCurrentPage = Math.floor(imgOffset / 20) + 1;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AdminLayout
      title="Library Catalog"
      subtitle="Organise library images into Content Category → Topic hierarchy for content generation."
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
        <button onClick={goToCategories}
          className={`hover:text-foreground transition-colors cursor-pointer ${view === "categories" ? "text-foreground font-medium" : ""}`}>
          Content Categories
        </button>
        {selectedCategory && (
          <>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            <button onClick={goToTopics}
              className={`hover:text-foreground transition-colors cursor-pointer ${view === "topics" ? "text-foreground font-medium" : ""}`}>
              {selectedCategory.name}
            </button>
          </>
        )}
        {selectedTopic && (
          <>
            <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            <span className="text-foreground font-medium">{selectedTopic.name}</span>
          </>
        )}
      </nav>

      {/* ── Level 1: Content categories ──────────────────────────────────────── */}
      {view === "categories" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{categoriesData?.contentCategories.length ?? 0} content categories</p>
            <Button size="sm" onClick={openCategoryCreate}
              className="gap-2 text-sm cursor-pointer" style={{ background: "hsl(243,75%,59%)", color: "white" }}>
              <Plus className="w-3.5 h-3.5" /> New Category
            </Button>
          </div>

          {categoriesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoriesData?.contentCategories.map((category) => {
                const c = themeColor(category.slug);
                const Icon = c.icon;
                return (
                  <div key={category.id}
                    className="relative group rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all"
                    style={{ background: c.bg, borderColor: c.border }}
                    onClick={() => selectCategory(category)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: c.text + "20" }}>
                          <Icon className="w-4 h-4" style={{ color: c.text }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{category.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {category.topicCount} topic{category.topicCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {/* Action buttons — visible on hover */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openCategoryEdit(category)}
                          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/50 transition-colors cursor-pointer">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => setDeleteConfirm({ kind: "category", id: category.id, name: category.name })}
                          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {category.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{category.description}</p>
                    )}
                    {!category.isActive && (
                      <span className="mt-2 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Inactive
                      </span>
                    )}
                    <ChevronRight className="absolute bottom-3.5 right-3.5 w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Level 2: Topics ──────────────────────────────────────────────────── */}
      {view === "topics" && selectedCategory && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {topicsData?.topics.length ?? 0} topics in <span className="font-medium text-foreground">{selectedCategory.name}</span>
            </p>
            <Button size="sm" onClick={openTopicCreate}
              className="gap-2 text-sm cursor-pointer" style={{ background: "hsl(243,75%,59%)", color: "white" }}>
              <Plus className="w-3.5 h-3.5" /> New Topic
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Column headers */}
            <div className="grid gap-4 px-5 py-2.5 bg-muted/30 border-b border-border"
              style={{ gridTemplateColumns: "1fr auto auto auto" }}>
              {["Topic", "Images", "Status", ""].map((h, i) => (
                <p key={i} className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {topicsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid gap-4 px-5 py-4 border-b border-border last:border-0 animate-pulse"
                  style={{ gridTemplateColumns: "1fr auto auto auto" }}>
                  <div className="h-3.5 bg-muted rounded w-32" />
                  <div className="h-3.5 bg-muted rounded w-8" />
                  <div className="h-3.5 bg-muted rounded w-12" />
                  <div className="h-3.5 bg-muted rounded w-16" />
                </div>
              ))
            ) : !topicsData?.topics.length ? (
              <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <Tag className="w-7 h-7 opacity-30" />
                <p className="text-sm font-medium">No topics yet</p>
                <p className="text-xs opacity-60">Create a topic to start assigning images.</p>
              </div>
            ) : (
              topicsData.topics.map((topic) => (
                <div key={topic.id}
                  className="grid gap-4 items-center px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/20 transition-colors group cursor-pointer"
                  style={{ gridTemplateColumns: "1fr auto auto auto" }}
                  onClick={() => selectTopic(topic)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{topic.name}</p>
                    {topic.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{topic.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium rounded-full px-2 py-0.5"
                    style={{ background: "hsl(243,75%,59%,0.10)", color: "hsl(243,75%,49%)" }}>
                    {topic.imageCount}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${topic.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {topic.isActive ? "Active" : "Inactive"}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end"
                    onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openTopicEdit(topic)}
                      className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ kind: "topic", id: topic.id, name: topic.name })}
                      className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Level 3: Images ──────────────────────────────────────────────────── */}
      {view === "images" && selectedTopic && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {imagesData?.total ?? 0} image{imagesData?.total !== 1 ? "s" : ""} in{" "}
              <span className="font-medium text-foreground">{selectedTopic.name}</span>
            </p>
            <Button size="sm" onClick={() => setShowPicker(true)}
              className="gap-2 text-sm cursor-pointer" style={{ background: "hsl(243,75%,59%)", color: "white" }}>
              <Plus className="w-3.5 h-3.5" /> Assign Images
            </Button>
          </div>

          {imagesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : !imagesData?.items.length ? (
            <div className="bg-card border border-border rounded-xl py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <ImageIcon className="w-8 h-8 opacity-30" />
              <p className="text-sm font-medium">No images assigned</p>
              <p className="text-xs opacity-60">Click "Assign Images" to add from the library.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {imagesData.items.map((item) => (
                  <div key={item.id} className="group relative rounded-xl overflow-hidden border border-border bg-muted aspect-square">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end p-2">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity w-full">
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {item.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-white">{t}</span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => removeImage(item.id)}
                          className="w-full flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {imgTotalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {imgOffset + 1}–{Math.min(imgOffset + 20, imagesData.total)} of {imagesData.total}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setImgOffset((o) => Math.max(0, o - 20))} disabled={imgOffset === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm px-1">{imgCurrentPage} / {imgTotalPages}</span>
                    <button onClick={() => setImgOffset((o) => o + 20)} disabled={imgOffset + 20 >= imagesData.total}
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer disabled:cursor-not-allowed">
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Content category form modal ──────────────────────────────────────── */}
      {categoryModal && (
        <FormModal
          title={categoryModal.mode === "create" ? "New Content Category" : "Edit Content Category"}
          fields={[
            { label: "Name", name: "name", value: formName, onChange: setFormName, placeholder: "e.g. Arts and Culture" },
            { label: "Description (optional)", name: "desc", value: formDesc, onChange: setFormDesc, multiline: true, placeholder: "Brief description of this category…" },
          ]}
          onSubmit={saveCategory}
          onClose={() => setCategoryModal(null)}
          isPending={savingCategory}
          error={formError}
        />
      )}

      {/* ── Topic form modal ─────────────────────────────────────────────────── */}
      {topicModal && (
        <FormModal
          title={topicModal.mode === "create" ? `New Topic in "${selectedCategory?.name}"` : "Edit Topic"}
          fields={[
            { label: "Name", name: "name", value: formName, onChange: setFormName, placeholder: "e.g. Classroom" },
            { label: "Description (optional)", name: "desc", value: formDesc, onChange: setFormDesc, multiline: true, placeholder: "Brief description…" },
          ]}
          onSubmit={saveTopic}
          onClose={() => setTopicModal(null)}
          isPending={savingTopic}
          error={formError}
        />
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground mb-2">Delete {deleteConfirm.kind}?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              <span className="font-medium text-foreground">"{deleteConfirm.name}"</span> will be permanently deleted.
              {deleteConfirm.kind === "category" && " All its topics and image assignments will be removed too."}
              {deleteConfirm.kind === "topic" && " All image assignments for this topic will be removed too."}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)} className="cursor-pointer">Cancel</Button>
              <Button size="sm" onClick={() => confirmDelete()} disabled={deleting}
                className="gap-2 cursor-pointer bg-red-500 hover:bg-red-600 text-white border-0">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Library picker modal ─────────────────────────────────────────────── */}
      {showPicker && selectedTopic && (
        <LibraryPicker
          topicId={selectedTopic.id}
          assignedIds={assignedIds}
          onClose={() => setShowPicker(false)}
          onAssigned={() => qc.invalidateQueries({ queryKey: ["topic-images", selectedTopic.id] })}
        />
      )}
    </AdminLayout>
  );
}

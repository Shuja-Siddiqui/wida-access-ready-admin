import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/admin-layout";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, MapPin, Hash, ChevronRight } from "lucide-react";

interface District {
  id: string;
  name: string;
  state?: string | null;
  districtCode?: string | null;
  schoolCount?: number | null;
}

interface DistrictFormState { name: string; state: string; districtCode: string; }
const EMPTY: DistrictFormState = { name: "", state: "", districtCode: "" };

export default function AdminDistricts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<District | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<District | null>(null);
  const [form, setForm] = useState<DistrictFormState>(EMPTY);

  const { data: raw, isLoading } = useQuery<District[]>({
    queryKey: ["admin-districts"],
    queryFn: () => apiRequest("/api/districts"),
  });
  const districts = Array.isArray(raw) ? raw : [];

  const createMut = useMutation({
    mutationFn: (body: Partial<District>) => apiRequest("/api/districts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-districts"] }); setFormOpen(false); toast({ title: "District created" }); },
    onError: () => toast({ title: "Failed to create district", variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<District> }) =>
      apiRequest(`/api/districts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-districts"] }); setFormOpen(false); toast({ title: "District updated" }); },
    onError: () => toast({ title: "Failed to update district", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/districts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-districts"] }); setDeleteTarget(null); toast({ title: "District deleted" }); },
    onError: () => toast({ title: "Failed to delete district", variant: "destructive" }),
  });

  function openCreate() { setEditing(null); setForm(EMPTY); setFormOpen(true); }
  function openEdit(d: District) { setEditing(d); setForm({ name: d.name, state: d.state ?? "", districtCode: d.districtCode ?? "" }); setFormOpen(true); }

  async function handleSave() {
    const body = { name: form.name.trim(), state: form.state.trim() || undefined, districtCode: form.districtCode.trim() || undefined };
    if (!body.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    editing ? updateMut.mutate({ id: editing.id, body }) : createMut.mutate(body);
  }

  return (
    <AdminLayout title="Districts">
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{districts.length} district{districts.length !== 1 ? "s" : ""}</p>
          <Button
            onClick={openCreate}
            size="sm"
            className="gap-1.5 text-white rounded-md"
            style={{ background: "hsl(243,75%,59%)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Add District
          </Button>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Head */}
          <div className="grid grid-cols-[2fr_80px_100px_120px_80px] gap-4 px-5 py-2.5 bg-muted/40 border-b border-border">
            {["Name", "State", "Code", "Schools", "Actions"].map((h) => (
              <p key={h} className="text-xs font-medium text-muted-foreground uppercase tracking-wide last:text-right">{h}</p>
            ))}
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_80px_100px_120px_80px] gap-4 px-5 py-3.5 border-b border-border last:border-0 animate-pulse">
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-muted shrink-0" /><div className="h-3.5 bg-muted rounded w-32" /></div>
                <div className="flex items-center"><div className="h-3 bg-muted rounded w-6" /></div>
                <div className="flex items-center"><div className="h-3 bg-muted rounded w-16" /></div>
                <div className="flex items-center"><div className="h-3 bg-muted rounded w-8" /></div>
                <div className="flex justify-end items-center gap-2"><div className="h-7 w-7 bg-muted rounded" /><div className="h-7 w-7 bg-muted rounded" /></div>
              </div>
            ))
          ) : !districts.length ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <Building2 className="w-8 h-8" />
              <p className="text-sm font-medium">No districts yet</p>
            </div>
          ) : (
            districts.map((d) => (
              <div key={d.id} className="grid grid-cols-[2fr_80px_100px_120px_80px] gap-4 items-center px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 group transition-colors">
                <button
                  className="flex items-center gap-3 min-w-0 text-left"
                  onClick={() => navigate(`/districts/${d.id}`)}
                >
                  <div className="w-8 h-8 rounded bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] text-xs font-semibold shrink-0">
                    {d.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{d.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {d.state ? <><MapPin className="w-3 h-3" />{d.state}</> : "—"}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                  {d.districtCode ? <><Hash className="w-3 h-3" />{d.districtCode}</> : "—"}
                </span>
                <span className="text-sm text-muted-foreground">{d.schoolCount ?? 0} school{(d.schoolCount ?? 0) !== 1 ? "s" : ""}</span>
                <div className="flex justify-end gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(d); }} className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(d); }} className="w-7 h-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit District" : "Add District"}</DialogTitle></DialogHeader>
          <div className="space-y-3.5 py-1">
            {[
              { key: "name", label: "District Name *", placeholder: "e.g. Chicago Public Schools" },
              { key: "state", label: "State", placeholder: "IL", maxLength: 2 },
              { key: "districtCode", label: "District Code", placeholder: "CPS-001" },
            ].map(({ key, label, placeholder, maxLength }) => (
              <div key={key}>
                <label className="text-sm font-medium text-foreground mb-1 block">{label}</label>
                <Input value={form[key as keyof DistrictFormState]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} maxLength={maxLength} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} style={{ background: "hsl(243,75%,59%)", color: "white" }}>
              {createMut.isPending || updateMut.isPending ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete district?</AlertDialogTitle>
            <AlertDialogDescription><strong>{deleteTarget?.name}</strong> will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

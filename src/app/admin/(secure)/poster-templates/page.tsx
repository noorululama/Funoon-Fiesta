"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Palette,
  Sparkles,
  Copy,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Eye,
  EyeOff,
  Layers,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";
import type { PosterTemplate } from "@/lib/types";
import { PosterTemplateEditor } from "@/components/admin/poster-template-editor";
import {
  getAllTemplatesAction,
  deletePosterTemplateAction,
  toggleTemplateActiveAction,
  duplicateTemplateAction,
  reorderTemplatesAction,
} from "./actions";

export default function PosterTemplatesAdminPage() {
  const [templates, setTemplates] = useState<PosterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<PosterTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await getAllTemplatesAction();
      setTemplates(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load poster templates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setProcessingId(id);
      const res = await deletePosterTemplateAction(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted "${name}"`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setProcessingId(id);
      const res = await toggleTemplateActiveAction(id, !currentStatus);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive: !currentStatus } : t))
      );
      toast.success(
        !currentStatus ? "Template activated for public downloads" : "Template deactivated"
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      setProcessingId(id);
      const res = await duplicateTemplateAction(id);
      if (res.error || !res.template) {
        toast.error(res.error || "Failed to duplicate template");
        return;
      }
      toast.success("Template duplicated successfully!");
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error("Failed to duplicate template");
    } finally {
      setProcessingId(null);
    }
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= templates.length) return;

    const newTemplates = [...templates];
    const [moved] = newTemplates.splice(index, 1);
    newTemplates.splice(targetIndex, 0, moved);

    setTemplates(newTemplates);

    try {
      const ids = newTemplates.map((t) => t.id);
      await reorderTemplatesAction(ids);
      toast.success("Order updated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save new order");
      fetchTemplates();
    }
  };

  // If currently in Editor view
  if (isCreatingNew || editingTemplate) {
    return (
      <PosterTemplateEditor
        initialTemplate={editingTemplate || undefined}
        onBack={() => {
          setIsCreatingNew(false);
          setEditingTemplate(null);
        }}
        onSaved={() => {
          fetchTemplates();
        }}
      />
    );
  }

  const activeCount = templates.filter((t) => t.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Poster Templates Studio
              </h2>
              <p className="text-sm text-white/60">
                Manage downloadable result poster designs, upload backgrounds, and adjust dynamic text overlays.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="bg-white/10 text-white/80 border-white/20 px-3 py-1 text-xs">
            {templates.length} Total • {activeCount} Active
          </Badge>
          <Button
            onClick={() => {
              setEditingTemplate(null);
              setIsCreatingNew(true);
            }}
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-900/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Poster Template
          </Button>
        </div>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white/5 border border-white/10 rounded-2xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
          <p className="text-sm text-white/50">Loading poster templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <Card className="bg-white/5 border-white/10 text-white p-12 text-center rounded-2xl">
          <Palette className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Poster Templates Found</h3>
          <p className="text-sm text-white/50 max-w-md mx-auto mb-6">
            Create your first poster template or seed the defaults to start generating posters.
          </p>
          <Button
            onClick={() => setIsCreatingNew(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Template
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, index) => {
            const isProcessing = processingId === template.id;

            return (
              <Card
                key={template.id}
                className={`bg-slate-900/90 border transition-all duration-300 rounded-2xl overflow-hidden flex flex-col justify-between ${
                  template.isActive
                    ? "border-white/15 hover:border-amber-500/40 shadow-xl"
                    : "border-white/5 opacity-60 hover:opacity-100"
                }`}
              >
                <div>
                  {/* Card Header & Preview */}
                  <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden border-b border-white/10 group">
                    <img
                      src={template.backgroundImageUrl || "/poster-template-1.webp"}
                      alt={template.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback placeholder image
                        (e.target as HTMLImageElement).src = "/poster-template-1.webp";
                      }}
                    />

                    {/* Status Badges Overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-black/70 backdrop-blur-md text-white border border-white/20">
                        #{index + 1}
                      </span>
                      {template.isActive ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/80 backdrop-blur-md text-white flex items-center gap-1 shadow-sm">
                          <Eye className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800/80 backdrop-blur-md text-white/70 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </div>

                    {/* Quick Move Order Buttons */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/20">
                      <button
                        onClick={() => handleMoveOrder(index, "up")}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveOrder(index, "down")}
                        disabled={index === templates.length - 1}
                        title="Move Down"
                        className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Template Meta */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                          {template.name}
                        </h4>
                        <p className="text-xs text-white/50">
                          {template.width}x{template.height}px •{" "}
                          {template.prizesLayout === "slots" ? "Custom Slots" : "Stacked List"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-white/60 bg-white/5 p-2.5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-white/40 block">Program Font:</span>
                        <span className="font-mono text-white/90 truncate block">
                          {template.programName?.fontSize || 74}px • {template.programName?.color || "#000"}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Prizes Font:</span>
                        <span className="font-mono text-white/90 truncate block">
                          {template.stackedSettings?.nameFontSize || 48}px • {template.stackedSettings?.nameColor || "#000"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-5 pt-0 border-t border-white/5 mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Active/Inactive Toggle */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(template.id, template.isActive)}
                      disabled={isProcessing}
                      title={template.isActive ? "Deactivate" : "Activate"}
                      className={`h-8 text-xs border-white/10 ${
                        template.isActive
                          ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/50"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {template.isActive ? "Active" : "Disabled"}
                    </Button>

                    {/* Duplicate */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDuplicate(template.id)}
                      disabled={isProcessing}
                      title="Duplicate Template"
                      className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id, template.name)}
                      disabled={isProcessing}
                      title="Delete Template"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setEditingTemplate(template)}
                    className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edit Studio
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  Upload,
  Save,
  ArrowLeft,
  Eye,
  Crosshair,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  Type,
  Trophy,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PosterTemplate, TextOverlayConfig } from "@/lib/types";
import { generateResultPoster } from "@/components/result-poster-canvas";
import { savePosterTemplateAction, uploadBackgroundAction } from "@/app/admin/(secure)/poster-templates/actions";

interface PosterTemplateEditorProps {
  initialTemplate?: PosterTemplate;
  onBack: () => void;
  onSaved?: (savedTemplate: PosterTemplate) => void;
}

const DEFAULT_SAMPLE_DATA = {
  programName: "Mappilappattu",
  section: "Single",
  category: "A",
  prizes: [
    { position: 1 as const, studentName: "Muhammed Ameen", teamName: "Al Hilal", chestNumber: "102" },
    { position: 2 as const, studentName: "Fathima Hiba", teamName: "Badar", chestNumber: "145" },
    { position: 3 as const, studentName: "Zayan Ali", teamName: "Uhud", chestNumber: "118" },
  ],
};

const FONT_OPTIONS = [
  { label: "Charutha (Default Serif)", value: "'Charutha', sans-serif" },
  { label: "Arial / Modern Sans", value: "'Arial', sans-serif" },
  { label: "Inter / Clean Sans", value: "'Inter', sans-serif" },
  { label: "Cinzel / Royal Serif", value: "'Cinzel', serif" },
  { label: "Courier / Monospace", value: "monospace" },
];

export function PosterTemplateEditor({
  initialTemplate,
  onBack,
  onSaved,
}: PosterTemplateEditorProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<PosterTemplate>(() => {
    if (initialTemplate) return initialTemplate;
    return {
      id: `template-${Date.now()}`,
      name: "New Poster Design",
      backgroundImageUrl: "/poster-template-1.webp",
      width: 1080,
      height: 1350,
      isActive: true,
      order: 1,
      programName: {
        enabled: true,
        x: 380,
        y: 400,
        fontSize: 74,
        fontFamily: "'Charutha', sans-serif",
        fontWeight: "normal",
        color: "#000000",
        align: "center",
        maxWidth: 940,
      },
      section: {
        enabled: true,
        x: 380,
        y: 460,
        fontSize: 48,
        fontFamily: "'Arial', sans-serif",
        fontWeight: "normal",
        color: "#000000",
        align: "center",
        maxWidth: 940,
      },
      prizesLayout: "stacked",
      stackedSettings: {
        startX: 180,
        startY: 608,
        spacingY: 120,
        nameFontSize: 48,
        nameColor: "#000000",
        nameFontFamily: "'Arial', sans-serif",
        teamFontSize: 32,
        teamColor: "#000000",
        teamFontFamily: "'Arial', sans-serif",
        teamOffsetY: 50,
        showChestNo: false,
        align: "left",
        maxWidth: 720,
      },
      slotsSettings: {
        slot1: { x: 180, y: 608, showChestNo: false },
        slot2: { x: 180, y: 728, showChestNo: false },
        slot3: { x: 180, y: 848, showChestNo: false },
        nameFontSize: 48,
        nameColor: "#000000",
        nameFontFamily: "'Arial', sans-serif",
        teamFontSize: 32,
        teamColor: "#000000",
        teamFontFamily: "'Arial', sans-serif",
        teamOffsetY: 50,
        showChestNo: false,
        align: "left",
      },
      footer: {
        enabled: true,
        text: "Official Results",
        x: 540,
        y: 1290,
        fontSize: 24,
        fontFamily: "'Arial', sans-serif",
        fontWeight: "normal",
        color: "rgba(255, 255, 255, 0.5)",
        align: "center",
        maxWidth: 940,
      },
    };
  });

  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeClickTarget, setActiveClickTarget] = useState<
    "program" | "section" | "prizes" | "footer" | "slot1" | "slot2" | "slot3" | null
  >(null);

  const previewCanvasRef = useRef<HTMLDivElement>(null);

  // Re-generate live canvas preview whenever template settings change
  useEffect(() => {
    let active = true;

    const renderPreview = async () => {
      try {
        setIsRendering(true);
        const dataUrl = await generateResultPoster(DEFAULT_SAMPLE_DATA, template);
        if (active) {
          setPreviewDataUrl(dataUrl);
        }
      } catch (err) {
        console.error("Live preview error:", err);
      } finally {
        if (active) {
          setIsRendering(false);
        }
      }
    };

    const timer = setTimeout(renderPreview, 80);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [template]);

  // Handle click on the canvas to set X & Y of the active target
  const handleCanvasClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeClickTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click position to base canvas dimensions
    const scaleX = (template.width || 1080) / rect.width;
    const scaleY = (template.height || 1350) / rect.height;

    const targetX = Math.round(clickX * scaleX);
    const targetY = Math.round(clickY * scaleY);

    if (activeClickTarget === "program") {
      setTemplate((prev) => ({
        ...prev,
        programName: { ...prev.programName, x: targetX, y: targetY },
      }));
      toast.info(`Program Name moved to X: ${targetX}, Y: ${targetY}`);
    } else if (activeClickTarget === "section") {
      setTemplate((prev) => ({
        ...prev,
        section: { ...prev.section, x: targetX, y: targetY },
      }));
      toast.info(`Section moved to X: ${targetX}, Y: ${targetY}`);
    } else if (activeClickTarget === "prizes") {
      setTemplate((prev) => ({
        ...prev,
        stackedSettings: { ...prev.stackedSettings, startX: targetX, startY: targetY },
      }));
      toast.info(`Prizes start moved to X: ${targetX}, Y: ${targetY}`);
    } else if (activeClickTarget === "footer") {
      setTemplate((prev) => ({
        ...prev,
        footer: { ...prev.footer, x: targetX, y: targetY },
      }));
      toast.info(`Footer moved to X: ${targetX}, Y: ${targetY}`);
    } else if (activeClickTarget.startsWith("slot")) {
      const slotKey = activeClickTarget as "slot1" | "slot2" | "slot3";
      setTemplate((prev) => ({
        ...prev,
        slotsSettings: {
          ...prev.slotsSettings!,
          [slotKey]: { ...prev.slotsSettings![slotKey], x: targetX, y: targetY },
        },
      }));
      toast.info(`${slotKey} moved to X: ${targetX}, Y: ${targetY}`);
    }
  };

  // Upload background file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadBackgroundAction(formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }

      setTemplate((prev) => ({
        ...prev,
        backgroundImageUrl: res.url!,
        width: res.width || prev.width,
        height: res.height || prev.height,
      }));
      toast.success("Background image uploaded and applied successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to upload background image");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Save template to database
  const handleSave = async () => {
    if (!template.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    try {
      setIsSaving(true);
      const res = await savePosterTemplateAction(template);
      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Poster template saved successfully!");
      if (onSaved && res.template) {
        onSaved(res.template);
      }
      onBack();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save poster template");
    } finally {
      setIsSaving(false);
    }
  };

  // Quick preset loader
  const loadPreset = (style: 1 | 2 | 3) => {
    const is2 = style === 2;
    const is3 = style === 3;

    setTemplate((prev) => ({
      ...prev,
      name: style === 1 ? "Royal Purple" : style === 2 ? "Midnight Blue" : "Emerald Green",
      backgroundImageUrl: `/poster-template-${style}.webp`,
      programName: {
        ...prev.programName,
        x: 380,
        y: 400,
        fontSize: 74,
        color: is2 ? "#ffffff" : is3 ? "#bd6229" : "#000000",
      },
      section: {
        ...prev.section,
        x: 380,
        y: 460,
        fontSize: 48,
        color: is2 ? "#e7a039" : "#000000",
      },
      stackedSettings: {
        ...prev.stackedSettings,
        startX: 180,
        startY: 608,
        spacingY: 120,
        nameColor: is2 ? "#ffffff" : "#000000",
        teamColor: is2 ? "#ffffff" : "#000000",
      },
    }));
    toast.success(`Loaded Preset Style ${style}!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              {template.name || "Untitled Template"}
            </h2>
            <p className="text-xs text-white/50">
              Interactive Poster Studio • {template.width}x{template.height}px
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
          <div className="hidden lg:flex items-center gap-1 border-r border-white/10 pr-3 mr-1">
            <span className="text-xs text-white/40 mr-1">Presets:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadPreset(1)}
              className="h-8 text-xs bg-purple-950/40 border-purple-500/30 text-purple-200 hover:bg-purple-900/50"
            >
              Purple
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadPreset(2)}
              className="h-8 text-xs bg-blue-950/40 border-blue-500/30 text-blue-200 hover:bg-blue-900/50"
            >
              Blue
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadPreset(3)}
              className="h-8 text-xs bg-emerald-950/40 border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/50"
            >
              Emerald
            </Button>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/20"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="xl:col-span-7 space-y-6">
          <Card className="bg-slate-900/90 border-white/10 text-white shadow-xl">
            <CardHeader className="pb-3 border-b border-white/10">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  Design Parameters
                </span>
                {activeClickTarget && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-2.5 py-1">
                    <Crosshair className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Click preview to place: <strong className="ml-1 uppercase text-amber-200">{activeClickTarget}</strong>
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-white/50 text-xs">
                Fine-tune positioning, fonts, colors, and layout rules for this poster template.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="bg-slate-950/70 border border-white/10 w-full p-1.5 rounded-2xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 h-auto mb-6 backdrop-blur-md shadow-inner">
                  {/* General Tab Button */}
                  <TabsTrigger
                    value="general"
                    className="group relative rounded-xl py-2.5 px-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 border border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-400/40 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-900/30 min-h-[42px]"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400 group-data-[state=active]:text-white transition-colors" />
                    <span>General</span>
                  </TabsTrigger>

                  {/* Program Tab Button */}
                  <TabsTrigger
                    value="program"
                    className="group relative rounded-xl py-2.5 px-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 border border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-400/40 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-900/30 min-h-[42px]"
                  >
                    <Type className="w-3.5 h-3.5 text-sky-400 group-data-[state=active]:text-white transition-colors" />
                    <span>Program</span>
                    {activeClickTarget === "program" && (
                      <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping absolute top-2 right-2" />
                    )}
                  </TabsTrigger>

                  {/* Section Tab Button */}
                  <TabsTrigger
                    value="section"
                    className="group relative rounded-xl py-2.5 px-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 border border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-400/40 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-900/30 min-h-[42px]"
                  >
                    <Layers className="w-3.5 h-3.5 text-violet-400 group-data-[state=active]:text-white transition-colors" />
                    <span>Section</span>
                    {activeClickTarget === "section" && (
                      <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping absolute top-2 right-2" />
                    )}
                  </TabsTrigger>

                  {/* Prizes Tab Button */}
                  <TabsTrigger
                    value="prizes"
                    className="group relative rounded-xl py-2.5 px-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 border border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-400/40 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-900/30 min-h-[42px]"
                  >
                    <Trophy className="w-3.5 h-3.5 text-yellow-400 group-data-[state=active]:text-white transition-colors" />
                    <span>Prizes</span>
                    {(activeClickTarget === "prizes" ||
                      activeClickTarget === "slot1" ||
                      activeClickTarget === "slot2" ||
                      activeClickTarget === "slot3") && (
                      <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping absolute top-2 right-2" />
                    )}
                  </TabsTrigger>

                  {/* Footer Tab Button */}
                  <TabsTrigger
                    value="footer"
                    className="group relative rounded-xl py-2.5 px-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 border border-transparent data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-400/40 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-900/30 min-h-[42px]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-data-[state=active]:text-white transition-colors" />
                    <span>Footer</span>
                    {activeClickTarget === "footer" && (
                      <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping absolute top-2 right-2" />
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: General & Background */}
                <TabsContent value="general" className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white/80 text-xs font-semibold">Template Name</Label>
                      <Input
                        value={template.name}
                        onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                        placeholder="e.g. Royal Purple Edition"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/80 text-xs font-semibold">Display Sequence Order</Label>
                      <Input
                        type="number"
                        value={template.order}
                        onChange={(e) => setTemplate({ ...template, order: Number(e.target.value) || 1 })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>

                  {/* Background Upload */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <Label className="text-white/80 text-xs font-semibold">Template Background Image</Label>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Input
                        value={template.backgroundImageUrl}
                        onChange={(e) => setTemplate({ ...template, backgroundImageUrl: e.target.value })}
                        placeholder="/poster-template-1.webp or /uploads/..."
                        className="bg-white/5 border-white/10 text-white text-xs font-mono"
                      />
                      <label className="cursor-pointer shrink-0">
                        <input
                          type="file"
                          accept="image/png,image/webp,image/jpeg"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                        <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-md">
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          {isUploading ? "Uploading..." : "Upload New Image"}
                        </span>
                      </label>
                    </div>
                    <p className="text-[11px] text-white/40">
                      Recommended: High-resolution WebP or PNG format (e.g. 1080x1350 vertical aspect ratio).
                    </p>
                  </div>

                  {/* Active Toggle & Dimensions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/10">
                    <div className="space-y-2">
                      <Label className="text-white/80 text-xs font-semibold">Target Width (px)</Label>
                      <Input
                        type="number"
                        value={template.width}
                        onChange={(e) => setTemplate({ ...template, width: Number(e.target.value) || 1080 })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80 text-xs font-semibold">Target Height (px)</Label>
                      <Input
                        type="number"
                        value={template.height}
                        onChange={(e) => setTemplate({ ...template, height: Number(e.target.value) || 1350 })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2 flex flex-col justify-end">
                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.isActive}
                          onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
                          className="rounded text-emerald-500 w-4 h-4"
                        />
                        <span className="text-xs text-white/90 font-medium">Template Active</span>
                      </label>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: Program Title */}
                <TabsContent value="program" className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white/90">Program Name Overlay</h4>
                    <Button
                      size="sm"
                      onClick={() =>
                        setActiveClickTarget(activeClickTarget === "program" ? null : "program")
                      }
                      className={`h-7 text-xs transition-all ${
                        activeClickTarget === "program"
                          ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-md shadow-amber-500/30 border border-amber-300"
                          : "bg-white/5 hover:bg-white/10 text-white/90 border border-white/20"
                      }`}
                    >
                      <Crosshair className={`w-3.5 h-3.5 mr-1 ${activeClickTarget === "program" ? "animate-spin" : ""}`} />
                      {activeClickTarget === "program" ? "Active (Click Preview)" : "Click to Place"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">X Position (px)</Label>
                      <Input
                        type="number"
                        value={template.programName.x}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            programName: { ...template.programName, x: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Y Position (px)</Label>
                      <Input
                        type="number"
                        value={template.programName.y}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            programName: { ...template.programName, y: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Font Size (px)</Label>
                      <Input
                        type="number"
                        value={template.programName.fontSize}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            programName: { ...template.programName, fontSize: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Text Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={template.programName.color || "#000000"}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              programName: { ...template.programName, color: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <Input
                          value={template.programName.color || "#000000"}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              programName: { ...template.programName, color: e.target.value },
                            })
                          }
                          className="bg-white/5 border-white/10 text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Font Family</Label>
                      <select
                        value={template.programName.fontFamily}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            programName: { ...template.programName, fontFamily: e.target.value },
                          })
                        }
                        className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-2 text-xs"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Alignment</Label>
                      <select
                        value={template.programName.align}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            programName: {
                              ...template.programName,
                              align: e.target.value as "left" | "center" | "right",
                            },
                          })
                        }
                        className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-2 text-xs"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Max Width (px)</Label>
                      <Input
                        type="number"
                        value={template.programName.maxWidth || 940}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            programName: { ...template.programName, maxWidth: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 3: Section / Category */}
                <TabsContent value="section" className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white/90">Section & Category Overlay</h4>
                    <Button
                      size="sm"
                      onClick={() =>
                        setActiveClickTarget(activeClickTarget === "section" ? null : "section")
                      }
                      className={`h-7 text-xs transition-all ${
                        activeClickTarget === "section"
                          ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-md shadow-amber-500/30 border border-amber-300"
                          : "bg-white/5 hover:bg-white/10 text-white/90 border border-white/20"
                      }`}
                    >
                      <Crosshair className={`w-3.5 h-3.5 mr-1 ${activeClickTarget === "section" ? "animate-spin" : ""}`} />
                      {activeClickTarget === "section" ? "Active (Click Preview)" : "Click to Place"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">X Position (px)</Label>
                      <Input
                        type="number"
                        value={template.section.x}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            section: { ...template.section, x: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Y Position (px)</Label>
                      <Input
                        type="number"
                        value={template.section.y}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            section: { ...template.section, y: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Font Size (px)</Label>
                      <Input
                        type="number"
                        value={template.section.fontSize}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            section: { ...template.section, fontSize: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Text Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={template.section.color || "#000000"}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              section: { ...template.section, color: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <Input
                          value={template.section.color || "#000000"}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              section: { ...template.section, color: e.target.value },
                            })
                          }
                          className="bg-white/5 border-white/10 text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Font Family</Label>
                      <select
                        value={template.section.fontFamily}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            section: { ...template.section, fontFamily: e.target.value },
                          })
                        }
                        className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-2 text-xs"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Alignment</Label>
                      <select
                        value={template.section.align}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            section: {
                              ...template.section,
                              align: e.target.value as "left" | "center" | "right",
                            },
                          })
                        }
                        className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-2 text-xs"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 4: Prize Winners */}
                <TabsContent value="prizes" className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold text-white/90">Layout Mode:</Label>
                      <select
                        value={template.prizesLayout}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            prizesLayout: e.target.value as "stacked" | "slots",
                          })
                        }
                        className="bg-slate-800 border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs"
                      >
                        <option value="stacked">Stacked List (Vertical with spacing)</option>
                        <option value="slots">Independent Slots (1st, 2nd, 3rd coordinates)</option>
                      </select>
                    </div>

                    {template.prizesLayout === "stacked" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setActiveClickTarget(activeClickTarget === "prizes" ? null : "prizes")
                        }
                        className={`h-7 text-xs transition-all ${
                          activeClickTarget === "prizes"
                            ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-md shadow-amber-500/30 border border-amber-300"
                            : "bg-white/5 hover:bg-white/10 text-white/90 border border-white/20"
                        }`}
                      >
                        <Crosshair className={`w-3.5 h-3.5 mr-1 ${activeClickTarget === "prizes" ? "animate-spin" : ""}`} />
                        {activeClickTarget === "prizes" ? "Active (Click Preview)" : "Click to Place 1st"}
                      </Button>
                    )}
                  </div>

                  {template.prizesLayout === "stacked" ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-white/70">Start X (px)</Label>
                          <Input
                            type="number"
                            value={template.stackedSettings.startX}
                            onChange={(e) =>
                              setTemplate({
                                ...template,
                                stackedSettings: {
                                  ...template.stackedSettings,
                                  startX: Number(e.target.value),
                                },
                              })
                            }
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-white/70">Start Y (1st place)</Label>
                          <Input
                            type="number"
                            value={template.stackedSettings.startY}
                            onChange={(e) =>
                              setTemplate({
                                ...template,
                                stackedSettings: {
                                  ...template.stackedSettings,
                                  startY: Number(e.target.value),
                                },
                              })
                            }
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-white/70">Row Spacing (px)</Label>
                          <Input
                            type="number"
                            value={template.stackedSettings.spacingY}
                            onChange={(e) =>
                              setTemplate({
                                ...template,
                                stackedSettings: {
                                  ...template.stackedSettings,
                                  spacingY: Number(e.target.value),
                                },
                              })
                            }
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-white/70">Team Subtext Offset Y</Label>
                          <Input
                            type="number"
                            value={template.stackedSettings.teamOffsetY}
                            onChange={(e) =>
                              setTemplate({
                                ...template,
                                stackedSettings: {
                                  ...template.stackedSettings,
                                  teamOffsetY: Number(e.target.value),
                                },
                              })
                            }
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                      </div>

                      {/* Winner Name Typography */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <span className="text-xs font-semibold text-white/80">Winner Name Styling</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-white/60">Font Size (px)</Label>
                            <Input
                              type="number"
                              value={template.stackedSettings.nameFontSize}
                              onChange={(e) =>
                                setTemplate({
                                  ...template,
                                  stackedSettings: {
                                    ...template.stackedSettings,
                                    nameFontSize: Number(e.target.value),
                                  },
                                })
                              }
                              className="bg-white/5 border-white/10 text-white h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-white/60">Color</Label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={template.stackedSettings.nameColor}
                                onChange={(e) =>
                                  setTemplate({
                                    ...template,
                                    stackedSettings: {
                                      ...template.stackedSettings,
                                      nameColor: e.target.value,
                                    },
                                  })
                                }
                                className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                              />
                              <Input
                                value={template.stackedSettings.nameColor}
                                onChange={(e) =>
                                  setTemplate({
                                    ...template,
                                    stackedSettings: {
                                      ...template.stackedSettings,
                                      nameColor: e.target.value,
                                    },
                                  })
                                }
                                className="bg-white/5 border-white/10 text-white h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-white/60">Alignment</Label>
                            <select
                              value={template.stackedSettings.align}
                              onChange={(e) =>
                                setTemplate({
                                  ...template,
                                  stackedSettings: {
                                    ...template.stackedSettings,
                                    align: e.target.value as "left" | "center" | "right",
                                  },
                                })
                              }
                              className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-1.5 text-xs h-8"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Team Name Typography */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                        <span className="text-xs font-semibold text-white/80">Team Subtext Styling</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-white/60">Font Size (px)</Label>
                            <Input
                              type="number"
                              value={template.stackedSettings.teamFontSize}
                              onChange={(e) =>
                                setTemplate({
                                  ...template,
                                  stackedSettings: {
                                    ...template.stackedSettings,
                                    teamFontSize: Number(e.target.value),
                                  },
                                })
                              }
                              className="bg-white/5 border-white/10 text-white h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-white/60">Color</Label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={template.stackedSettings.teamColor}
                                onChange={(e) =>
                                  setTemplate({
                                    ...template,
                                    stackedSettings: {
                                      ...template.stackedSettings,
                                      teamColor: e.target.value,
                                    },
                                  })
                                }
                                className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                              />
                              <Input
                                value={template.stackedSettings.teamColor}
                                onChange={(e) =>
                                  setTemplate({
                                    ...template,
                                    stackedSettings: {
                                      ...template.stackedSettings,
                                      teamColor: e.target.value,
                                    },
                                  })
                                }
                                className="bg-white/5 border-white/10 text-white h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div className="space-y-1 flex items-end">
                            <label className="flex items-center gap-2 p-1.5 rounded bg-white/5 cursor-pointer w-full h-8">
                              <input
                                type="checkbox"
                                checked={template.stackedSettings.showChestNo}
                                onChange={(e) =>
                                  setTemplate({
                                    ...template,
                                    stackedSettings: {
                                      ...template.stackedSettings,
                                      showChestNo: e.target.checked,
                                    },
                                  })
                                }
                                className="rounded text-emerald-500 w-3.5 h-3.5"
                              />
                              <span className="text-[11px] text-white/80">Show Chest #</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Slots Mode */
                    <div className="space-y-4">
                      {(["slot1", "slot2", "slot3"] as const).map((sKey, index) => {
                        const slot = template.slotsSettings?.[sKey] || { x: 180, y: 608 + index * 120 };
                        return (
                          <div
                            key={sKey}
                            className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-400">
                                Position {index + 1} ({index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"} Place)
                              </span>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setActiveClickTarget(activeClickTarget === sKey ? null : sKey)
                                }
                                className={`h-6 text-[10px] transition-all ${
                                  activeClickTarget === sKey
                                    ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-md shadow-amber-500/30 border border-amber-300"
                                    : "bg-white/5 hover:bg-white/10 text-white/90 border border-white/20"
                                }`}
                              >
                                <Crosshair className={`w-3 h-3 mr-1 ${activeClickTarget === sKey ? "animate-spin" : ""}`} />
                                {activeClickTarget === sKey ? "Active" : "Click to Place"}
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-white/60">X Position (px)</Label>
                                <Input
                                  type="number"
                                  value={slot.x}
                                  onChange={(e) =>
                                    setTemplate({
                                      ...template,
                                      slotsSettings: {
                                        ...template.slotsSettings!,
                                        [sKey]: { ...slot, x: Number(e.target.value) },
                                      },
                                    })
                                  }
                                  className="bg-white/5 border-white/10 text-white h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-white/60">Y Position (px)</Label>
                                <Input
                                  type="number"
                                  value={slot.y}
                                  onChange={(e) =>
                                    setTemplate({
                                      ...template,
                                      slotsSettings: {
                                        ...template.slotsSettings!,
                                        [sKey]: { ...slot, y: Number(e.target.value) },
                                      },
                                    })
                                  }
                                  className="bg-white/5 border-white/10 text-white h-8 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* TAB 5: Footer & Branding */}
                <TabsContent value="footer" className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white/90">Footer Attribution</h4>
                    <Button
                      size="sm"
                      onClick={() =>
                        setActiveClickTarget(activeClickTarget === "footer" ? null : "footer")
                      }
                      className={`h-7 text-xs transition-all ${
                        activeClickTarget === "footer"
                          ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-md shadow-amber-500/30 border border-amber-300"
                          : "bg-white/5 hover:bg-white/10 text-white/90 border border-white/20"
                      }`}
                    >
                      <Crosshair className={`w-3.5 h-3.5 mr-1 ${activeClickTarget === "footer" ? "animate-spin" : ""}`} />
                      {activeClickTarget === "footer" ? "Active (Click Preview)" : "Click to Place"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-white/70">Footer Text</Label>
                    <Input
                      value={template.footer.text}
                      onChange={(e) =>
                        setTemplate({
                          ...template,
                          footer: { ...template.footer, text: e.target.value },
                        })
                      }
                      placeholder="e.g. Official Results • Funoon Fiesta 2026"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">X Position (px)</Label>
                      <Input
                        type="number"
                        value={template.footer.x}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            footer: { ...template.footer, x: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Y Position (px)</Label>
                      <Input
                        type="number"
                        value={template.footer.y}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            footer: { ...template.footer, y: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Font Size (px)</Label>
                      <Input
                        type="number"
                        value={template.footer.fontSize}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            footer: { ...template.footer, fontSize: Number(e.target.value) },
                          })
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Text Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={template.footer.color?.startsWith("#") ? template.footer.color : "#ffffff"}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              footer: { ...template.footer, color: e.target.value },
                            })
                          }
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <Input
                          value={template.footer.color}
                          onChange={(e) =>
                            setTemplate({
                              ...template,
                              footer: { ...template.footer, color: e.target.value },
                            })
                          }
                          placeholder="#ffffff or rgba(...)"
                          className="bg-white/5 border-white/10 text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Font Family</Label>
                      <select
                        value={template.footer.fontFamily || "'Arial', sans-serif"}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            footer: { ...template.footer, fontFamily: e.target.value },
                          })
                        }
                        className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-2 text-xs"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/70">Alignment</Label>
                      <select
                        value={template.footer.align || "center"}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            footer: {
                              ...template.footer,
                              align: e.target.value as "left" | "center" | "right",
                            },
                          })
                        }
                        className="w-full bg-slate-800 border border-white/10 text-white rounded-lg p-2 text-xs"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Column */}
        <div className="xl:col-span-5 space-y-4">
          <Card className="bg-slate-900/90 border-white/10 text-white shadow-2xl sticky top-6">
            <CardHeader className="pb-3 border-b border-white/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Live Preview Studio
                </CardTitle>
                <CardDescription className="text-white/50 text-[11px]">
                  {activeClickTarget
                    ? `Click anywhere on the preview to position ${activeClickTarget}`
                    : "Real-time interactive rendering with sample test data"}
                </CardDescription>
              </div>

              {previewDataUrl && (
                <a
                  href={previewDataUrl}
                  download={`${template.name || "poster"}-preview.png`}
                  className="inline-flex items-center text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                  title="Download test PNG"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Test PNG
                </a>
              )}
            </CardHeader>

            <CardContent className="pt-4 flex flex-col items-center">
              <div
                ref={previewCanvasRef}
                className={`relative rounded-xl overflow-hidden border-2 shadow-2xl bg-black max-w-[340px] w-full transition-all ${
                  activeClickTarget
                    ? "border-amber-400 cursor-crosshair ring-4 ring-amber-400/20"
                    : "border-white/10"
                }`}
              >
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt="Live Poster Preview"
                    onClick={handleCanvasClick}
                    className="w-full h-auto block select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="aspect-[1080/1350] w-full flex items-center justify-center bg-slate-950 text-white/50 text-xs">
                    Rendering poster preview...
                  </div>
                )}

                {isRendering && (
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white/70 animate-pulse">
                    Updating...
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                <p className="text-[11px] text-white/40">
                  {activeClickTarget ? (
                    <span className="text-amber-300 font-medium">
                      🎯 Click anywhere on the image above to set position for: {activeClickTarget}
                    </span>
                  ) : (
                    "Tip: Select 'Click to Place' on any tab to click-and-set coordinates visually."
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import type { FestConfig } from "@/lib/types";
import { fetchFestConfigAction, saveFestConfigAction } from "./rules-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sliders, Award, Layers, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";

export function RulesConfigSection() {
  const [config, setConfig] = useState<FestConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [enableCat, setEnableCat] = useState(true);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const data = await fetchFestConfigAction();
        setConfig(data);
        setEnableCat(data.scoring?.enableCategories ?? true);
      } catch (err) {
        console.error("Failed to load rules config:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const res = await saveFestConfigAction(formData);
      if (res.error) {
        setMessage({ text: res.error, isError: true });
        toast.error(res.error);
      } else if (res.success) {
        setMessage({ text: res.success });
        toast.success(res.success);
      }
    });
  };

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
          <span className="ml-3 text-sm text-white/60">Loading Festival Rules...</span>
        </CardContent>
      </Card>
    );
  }

  const limits = config?.limits || { maxSingleOnStage: 3, maxSingleOffStage: 4, maxGeneral: 3 };
  const scoring = config?.scoring || {
    enableCategories: true,
    categoryScores: { A: { 1: 10, 2: 7, 3: 5 }, B: { 1: 7, 2: 5, 3: 3 }, C: { 1: 5, 2: 3, 3: 1 } },
    gradeBonus: { A: 5, B: 3, C: 1 },
    generalScores: { 1: 20, 2: 15, 3: 10 },
    flatSingleScores: { 1: 10, 2: 7, 3: 5 },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SECTION 1: CANDIDATE PARTICIPATION LIMITS */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-fuchsia-400">
            <Sliders className="h-5 w-5" />
            Candidate Participation Limits
          </CardTitle>
          <CardDescription className="text-white/60">
            Set maximum number of programs a single candidate can participate in.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5">
            <Label htmlFor="maxSingleOnStage" className="font-semibold text-white/90">
              Individual On-Stage Events Limit
            </Label>
            <p className="text-xs text-white/50">Max single on-stage programs per student</p>
            <Input
              id="maxSingleOnStage"
              name="maxSingleOnStage"
              type="number"
              min="1"
              max="20"
              defaultValue={limits.maxSingleOnStage}
              className="bg-slate-900/60 border-white/10 text-white font-bold"
            />
          </div>

          <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5">
            <Label htmlFor="maxSingleOffStage" className="font-semibold text-white/90">
              Individual Off-Stage Events Limit
            </Label>
            <p className="text-xs text-white/50">Max single off-stage programs per student</p>
            <Input
              id="maxSingleOffStage"
              name="maxSingleOffStage"
              type="number"
              min="1"
              max="20"
              defaultValue={limits.maxSingleOffStage}
              className="bg-slate-900/60 border-white/10 text-white font-bold"
            />
          </div>

          <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5">
            <Label htmlFor="maxGeneral" className="font-semibold text-white/90">
              General / Group Events Limit
            </Label>
            <p className="text-xs text-white/50">Max group programs per student</p>
            <Input
              id="maxGeneral"
              name="maxGeneral"
              type="number"
              min="1"
              max="20"
              defaultValue={limits.maxGeneral}
              className="bg-slate-900/60 border-white/10 text-white font-bold"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: DYNAMIC SCORING RULES */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Award className="h-5 w-5" />
              Dynamic Scoring & Point Matrix
            </CardTitle>
            <CardDescription className="text-white/60 mt-1">
              Configure point values for categories, grades, and group positions.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border border-white/10">
            <input
              type="checkbox"
              id="enableCategories"
              name="enableCategories"
              checked={enableCat}
              onChange={(e) => setEnableCat(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
            />
            <Label htmlFor="enableCategories" className="text-sm font-medium text-white cursor-pointer">
              Enable Categories (A / B / C)
            </Label>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {enableCat ? (
            /* Category Scores Matrix */
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Layers className="h-4 w-4 text-fuchsia-400" />
                Category Base Position Scores (1st, 2nd, 3rd)
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Category A */}
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 p-4 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-fuchsia-300">Category A</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-white/60">1st</Label>
                      <Input
                        name="categoryA1"
                        type="number"
                        defaultValue={scoring.categoryScores?.A?.[1] ?? 10}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">2nd</Label>
                      <Input
                        name="categoryA2"
                        type="number"
                        defaultValue={scoring.categoryScores?.A?.[2] ?? 7}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">3rd</Label>
                      <Input
                        name="categoryA3"
                        type="number"
                        defaultValue={scoring.categoryScores?.A?.[3] ?? 5}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Category B */}
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-purple-300">Category B</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-white/60">1st</Label>
                      <Input
                        name="categoryB1"
                        type="number"
                        defaultValue={scoring.categoryScores?.B?.[1] ?? 7}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">2nd</Label>
                      <Input
                        name="categoryB2"
                        type="number"
                        defaultValue={scoring.categoryScores?.B?.[2] ?? 5}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">3rd</Label>
                      <Input
                        name="categoryB3"
                        type="number"
                        defaultValue={scoring.categoryScores?.B?.[3] ?? 3}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Category C */}
                <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-sky-300">Category C</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-white/60">1st</Label>
                      <Input
                        name="categoryC1"
                        type="number"
                        defaultValue={scoring.categoryScores?.C?.[1] ?? 5}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">2nd</Label>
                      <Input
                        name="categoryC2"
                        type="number"
                        defaultValue={scoring.categoryScores?.C?.[2] ?? 3}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-white/60">3rd</Label>
                      <Input
                        name="categoryC3"
                        type="number"
                        defaultValue={scoring.categoryScores?.C?.[3] ?? 1}
                        className="bg-slate-900/80 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Flat Single Program Scores */
            <div className="space-y-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
              <p className="text-sm font-semibold text-amber-300">
                Flat Single Event Position Base Scores (Categories Disabled)
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-white/60">1st Place</Label>
                  <Input
                    name="flatSingle1"
                    type="number"
                    defaultValue={scoring.flatSingleScores?.[1] ?? 10}
                    className="bg-slate-900/80 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/60">2nd Place</Label>
                  <Input
                    name="flatSingle2"
                    type="number"
                    defaultValue={scoring.flatSingleScores?.[2] ?? 7}
                    className="bg-slate-900/80 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/60">3rd Place</Label>
                  <Input
                    name="flatSingle3"
                    type="number"
                    defaultValue={scoring.flatSingleScores?.[3] ?? 5}
                    className="bg-slate-900/80 border-white/10 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Grade Bonus Scores */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <h4 className="text-sm font-semibold text-white/80">Grade Bonus Points (Added to Single Winners)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <Label className="text-xs text-emerald-400 font-bold">Grade A Bonus</Label>
                <Input
                  name="gradeBonusA"
                  type="number"
                  defaultValue={scoring.gradeBonus?.A ?? 5}
                  className="bg-slate-900/80 border-white/10 text-white mt-1"
                />
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <Label className="text-xs text-blue-400 font-bold">Grade B Bonus</Label>
                <Input
                  name="gradeBonusB"
                  type="number"
                  defaultValue={scoring.gradeBonus?.B ?? 3}
                  className="bg-slate-900/80 border-white/10 text-white mt-1"
                />
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <Label className="text-xs text-yellow-400 font-bold">Grade C Bonus</Label>
                <Input
                  name="gradeBonusC"
                  type="number"
                  defaultValue={scoring.gradeBonus?.C ?? 1}
                  className="bg-slate-900/80 border-white/10 text-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* General / Group Scores */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <h4 className="text-sm font-semibold text-white/80">General / Group Event Team Points</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <Label className="text-xs text-amber-300 font-bold">1st Place Team</Label>
                <Input
                  name="general1"
                  type="number"
                  defaultValue={scoring.generalScores?.[1] ?? 20}
                  className="bg-slate-900/80 border-white/10 text-white mt-1"
                />
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <Label className="text-xs text-slate-300 font-bold">2nd Place Team</Label>
                <Input
                  name="general2"
                  type="number"
                  defaultValue={scoring.generalScores?.[2] ?? 15}
                  className="bg-slate-900/80 border-white/10 text-white mt-1"
                />
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <Label className="text-xs text-orange-400 font-bold">3rd Place Team</Label>
                <Input
                  name="general3"
                  type="number"
                  defaultValue={scoring.generalScores?.[3] ?? 10}
                  className="bg-slate-900/80 border-white/10 text-white mt-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SUCCESS / ERROR FEEDBACK */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            message.isError
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          }`}
        >
          {message.isError ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* SAVE BUTTON */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 px-8">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isPending ? "Saving Rules..." : "Save Rules & Scoring Matrix"}
        </Button>
      </div>
    </form>
  );
}

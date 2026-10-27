"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Activity, Medal, TrendingUp, TrendingDown, Minus, ArrowUpRight, BarChart3, PieChart, LineChart } from "lucide-react";
import type { Team } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";

interface LiveScorePulseProps {
  teams: Team[];
  liveScores: Map<string, number>;
}

// Dynamic Team Colors derived from team.color set in Admin Panel
export interface TeamColorStyles {
  primary: string;
  darker: string;
  lighter: string;
  light: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textMuted: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  trackBg: string;
  barFill: string;
  glow: string;
  isLight: boolean;
  rgba: (alpha: number) => string;
}

const FALLBACK_PALETTE = [
  "#D72638",
  "#1E3A8A",
  "#7C3AED",
  "#F59E0B",
  "#059669",
  "#EA580C",
  "#06B6D4",
  "#EC4899",
];

const DEFAULT_NAME_COLORS: Record<string, string> = {
  SAMARQAND: "#E11D48",
  SAMARKAND: "#E11D48",
  NAHAVAND: "#2563EB",
  YAMAMA: "#7C3AED",
  YAMAMAH: "#7C3AED",
  QURTUBA: "#D97706",
  QURTHUBA: "#D97706",
  MUQADDAS: "#059669",
  BUKHARA: "#EA580C",
  BUSTAN: "#D72638",
  DASTAN: "#1E3A8A",
  DIWAN: "#7C3AED",
  GULISTAN: "#FACC15",
  KHARISTAN: "#059669",
  RAYHAN: "#FB923C",
};

function parseHexColor(color: string): { r: number; g: number; b: number } {
  if (!color) return { r: 107, g: 114, b: 128 };
  let hex = color.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6) {
    return { r: 107, g: 114, b: 128 };
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) return { r: 107, g: 114, b: 128 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getTeamColorStyles(colorInput?: string, teamName?: string, index: number = 0): TeamColorStyles {
  let rawColor = colorInput?.trim();
  if (!rawColor || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(rawColor)) {
    if (teamName) {
      const normalized = teamName.trim().toUpperCase();
      rawColor = DEFAULT_NAME_COLORS[normalized];
    }
  }
  if (!rawColor || !/^#([0-9A-Fa-f]{3}){1,2}$/.test(rawColor)) {
    rawColor = FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  }

  const { r, g, b } = parseHexColor(rawColor);
  const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

  // Calculate relative luminance to guarantee WCAG high contrast readability
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const isLight = luminance > 0.62;

  // Darker shade for contrast & rich card gradients (approx 28% darker)
  const dr = Math.max(0, Math.round(r * 0.72));
  const dg = Math.max(0, Math.round(g * 0.72));
  const db = Math.max(0, Math.round(b * 0.72));
  const darker = `rgb(${dr}, ${dg}, ${db})`;

  // Lighter shade for highlights (approx 20% lighter)
  const lr = Math.min(255, Math.round(r + (255 - r) * 0.22));
  const lg = Math.min(255, Math.round(g + (255 - g) * 0.22));
  const lb = Math.min(255, Math.round(b + (255 - b) * 0.22));
  const lighter = `rgb(${lr}, ${lg}, ${lb})`;

  const textColor = isLight ? "#0f172a" : "#ffffff";
  const textMuted = isLight ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.82)";
  const badgeBg = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.18)";
  const badgeBorder = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.28)";
  const badgeText = isLight ? "#0f172a" : "#ffffff";
  const trackBg = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.22)";
  const barFill = isLight ? "#0f172a" : "#ffffff";
  const cardBorder = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.16)";
  const glow = `0 14px 34px -4px ${rgba(0.38)}, 0 6px 16px -4px ${rgba(0.22)}`;

  return {
    primary: rawColor,
    darker,
    lighter,
    light: rgba(0.12),
    cardBg: `linear-gradient(135deg, ${rawColor} 0%, ${darker} 100%)`,
    cardBorder,
    textColor,
    textMuted,
    badgeBg,
    badgeBorder,
    badgeText,
    trackBg,
    barFill,
    glow,
    isLight,
    rgba,
  };
}

function getMedalColor(rank: number): string {
  switch (rank) {
    case 1: return "#FFD700";
    case 2: return "#C0C0C0";
    case 3: return "#CD7F32";
    default: return "transparent";
  }
}

interface TeamCardProps {
  team: Team & { totalPoints: number; colors: TeamColorStyles };
  index: number;
  rank: number;
  maxPoints: number;
}

function TeamCard({ team, index, rank, maxPoints }: TeamCardProps) {
  const percentage = maxPoints > 0 ? (team.totalPoints / maxPoints) * 100 : 0;
  const isTopThree = rank <= 3;
  const colors = team.colors;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="relative group"
    >
      <div
        className="relative overflow-hidden rounded-3xl p-5 md:p-6 transition-all duration-300 shadow-xl z-0"
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
          boxShadow: colors.glow,
          color: colors.textColor,
        }}
      >
        {/* Soft radial reflection in top-right */}
        <div
          className="absolute -top-20 -right-20 w-52 h-52 rounded-full pointer-events-none blur-2xl"
          style={{
            background: colors.isLight ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.22)",
          }}
        />

        {/* Ambient watermark initial */}
        <div
          className="absolute -bottom-6 -right-2 text-8xl md:text-9xl font-black select-none pointer-events-none leading-none tracking-tighter"
          style={{
            color: colors.isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.1)",
          }}
        >
          {team.name[0]}
        </div>

        {/* Top Section */}
        <div className="relative z-10 flex items-start justify-between mb-5">
          <div className="flex items-center gap-3.5">
            {/* Frosted Rank Badge */}
            <div
              className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl font-black text-lg shadow-md backdrop-blur-md"
              style={{
                backgroundColor: colors.badgeBg,
                border: `1px solid ${colors.badgeBorder}`,
                color: colors.badgeText,
              }}
            >
              <span className="leading-none">#{rank}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="font-extrabold text-lg md:text-xl tracking-tight leading-none"
                  style={{ color: colors.textColor }}
                >
                  {team.name}
                </h3>
                {isTopThree && (
                  <Medal
                    className="w-5 h-5 drop-shadow-md animate-pulse shrink-0"
                    style={{
                      color: getMedalColor(rank),
                      filter: colors.isLight ? "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" : "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
                    }}
                  />
                )}
              </div>

              {/* Trend Pill */}
              <div className="mt-1.5 flex items-center">
                <div
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md"
                  style={{
                    backgroundColor: colors.badgeBg,
                    border: `1px solid ${colors.badgeBorder}`,
                    color: colors.textColor,
                  }}
                >
                  {rank === 1 ? (
                    <>
                      <TrendingUp className="w-3 h-3 mr-1" /> Leading
                    </>
                  ) : rank <= 3 ? (
                    <>
                      <TrendingUp className="w-3 h-3 mr-1" /> Chasing
                    </>
                  ) : (
                    <>
                      <Minus className="w-3 h-3 mr-1" /> Stable
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Points Counter */}
          <div className="text-right">
            <span
              className="block text-3xl md:text-4xl font-black tracking-tight"
              style={{
                fontVariantNumeric: "tabular-nums",
                color: colors.textColor,
              }}
            >
              {formatNumber(team.totalPoints)}
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-wider block -mt-0.5"
              style={{ color: colors.textMuted }}
            >
              Points
            </span>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="relative z-10 space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span style={{ color: colors.textMuted }}>Performance</span>
            <span style={{ color: colors.textColor, fontWeight: 700 }}>{percentage.toFixed(0)}%</span>
          </div>

          <div
            className="h-2.5 w-full rounded-full overflow-hidden p-[2px] backdrop-blur-sm"
            style={{ backgroundColor: colors.trackBg }}
          >
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "circOut" }}
              className="h-full rounded-full relative overflow-hidden"
              style={{ backgroundColor: colors.barFill }}
            >
              <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" />
            </motion.div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// Chart Components
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 ring-1 ring-black/5">
        <p className="font-bold text-gray-900 text-lg mb-1">{data.name}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.colors.primary }} />
          <p className="font-mono font-bold text-gray-600">
            {formatNumber(data.totalPoints)} <span className="text-xs font-sans font-normal text-gray-400">PTS</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

function AnalyticsSection({ teams }: { teams: any[] }) {
  const [viewMode, setViewMode] = useState<'total' | 'daily' | 'category'>('total');

  return (
    <div className="h-full bg-white border border-gray-100 rounded-3xl p-6 shadow-xl flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h4 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#8B4513]" /> Analytics
          </h4>
          <p className="text-sm text-gray-500">Live performance breakdown</p>
        </div>

        {/* Toggles */}
        <div className="flex p-1 bg-gray-100 rounded-3xl">
          <button
            onClick={() => setViewMode('total')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'total' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Total
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'category' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Cat.
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[300px] relative">
        {viewMode === 'total' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teams} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 700 }}
                dy={10}
                tickFormatter={(value: string) => value.slice(0, 3).toUpperCase()}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="totalPoints" radius={[6, 6, 6, 6]} barSize={32} animationDuration={1000}>
                {teams.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.colors.primary} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <LineChart className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm font-medium">Detailed breakdown coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LiveScorePulse({ teams, liveScores }: LiveScorePulseProps) {
  const teamsWithScores = teams.map((team, index) => {
    const totalPoints = liveScores.get(team.id) ?? team.total_points;
    const colors = getTeamColorStyles(team.color, team.name, index);
    return { ...team, totalPoints, colors };
  });

  const sortedTeams = [...teamsWithScores].sort((a, b) => b.totalPoints - a.totalPoints);

  let currentRank = 1;
  const rankedTeams = sortedTeams.map((team, index) => {
    if (index > 0 && team.totalPoints < sortedTeams[index - 1].totalPoints) {
      currentRank++;
    }
    return { ...team, rank: currentRank };
  });

  const maxPoints = Math.max(...rankedTeams.map((t) => t.totalPoints), 1);
  const MAX_VISIBLE = 3;
  const visibleTeams = rankedTeams.slice(0, MAX_VISIBLE);
  const overflow = rankedTeams.length - MAX_VISIBLE;

  return (
    <section className="space-y-8 relative z-10">
      {/* Background Decor */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-40 right-0 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-2"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
            </span>
            <span className="text-red-600 font-bold tracking-widest text-xs uppercase">Live Updates</span>
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#8B4513] to-amber-600">SCORE</span> PULSE
          </h2>
          <p className="text-gray-500 max-w-md text-lg">
            Real-time tracking of the championship race. Watch the battle unfold.
          </p>
        </div>

        <div className="hidden md:block pb-2">
          <div className="flex items-center -space-x-3" role="group" aria-label="Top ranked teams">
            {visibleTeams.map((t) => (
              <div
                key={t.id}
                title={t.name}
                style={{ backgroundColor: t.colors.light, color: t.colors.primary }}
                className="relative flex h-10 w-10 items-center justify-center rounded-full
                           text-xs font-semibold uppercase ring-2 ring-white shadow-sm
                           transition-all duration-200 ease-out
                           hover:z-10 hover:-translate-y-1 hover:scale-110 hover:shadow-md"
              >
                {t.name[0]}
              </div>
            ))}

            {overflow > 0 && (
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-full
                           bg-slate-100 text-xs font-medium text-slate-500 ring-2 ring-white shadow-sm"
                aria-label={`${overflow} more teams`}
              >
                +{overflow}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Team Cards - Left Column */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rankedTeams.map((team, index) => (
              <TeamCard key={team.id} team={team} index={index} rank={team.rank} maxPoints={maxPoints} />
            ))}
          </div>
        </div>

        {/* Analytics - Right Side */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1"
          >
            <AnalyticsSection teams={sortedTeams} />
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 gap-3"
          >
            <Link href="/scoreboard" className="w-full">
              <Button className="w-full h-14 text-lg font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg shadow-zinc-900/20 hover:shadow-zinc-900/30 transition-all rounded-2xl group">
                Full Scoreboard <ArrowUpRight className="ml-2 w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

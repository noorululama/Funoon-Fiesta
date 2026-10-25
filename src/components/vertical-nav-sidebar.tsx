"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Trophy,
  BarChart3,
  Search,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/results", label: "Results", icon: Trophy },
  { href: "/scoreboard", label: "Scoreboard", icon: BarChart3 },
  { href: "/participant", label: "Find Participant", icon: Search },
  { href: "/chatbot", label: "AI Assistant", icon: Bot },
];

export function VerticalNavSidebar() {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  const renderLink = (item: typeof navItems[number], orientation: "vertical" | "horizontal") => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href ||
      (item.href !== "/" && pathname?.startsWith(item.href));

    return (
      <Link
        key={`${orientation}-${item.label}`}
        href={item.href}
        className={cn(
          "relative flex items-center justify-center transition-all duration-300 text-center",
          orientation === "vertical"
            ? "w-10 h-10 md:w-12 md:h-12 rounded-2xl group hover:rounded-2xl"
            : "flex-1 flex-col py-2 rounded-2xl",
          isActive
            ? "bg-gradient-to-tr from-[#70B040] to-[#F09030] text-white shadow-md shadow-emerald-500/20"
            : "text-gray-600 hover:bg-gray-50 hover:text-[#70B040]"
        )}
        title={item.label}
      >
        <Icon
          className={cn(
            "w-5 h-5 transition-all duration-300",
            isActive && "scale-110"
          )}
        />
        {orientation === "horizontal" && (
          <span className="text-xs font-semibold mt-1"></span>
        )}
        {/* Active indicator glow */}
        {isActive && (
          <span className="absolute inset-0 rounded-2xl bg-[#70B040]/20 blur-lg -z-10" />
        )}
        {/* Tooltip on hover (desktop only) */}
        {orientation === "vertical" && (
          <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap shadow-xl z-50">
            {item.label}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1.5 h-1.5 bg-gray-900 rotate-45 rounded-xl" />
          </span>
        )}
      </Link>
    );
  };

  const isHome = pathname === "/";

  return (
    <>
      {/* Desktop vertical sidebar (hidden on home page to let hero header shine) */}
      {!isHome && (
        <aside
          className="hidden lg:flex fixed left-10 top-8 z-50 flex-col items-center"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
        {/* Trigger Icon */}
        <div className="cursor-pointer drop-shadow-lg transition-transform duration-300 hover:scale-105 relative z-20">
          <Image
            src="/img/hero/navicon.svg"
            width={50}
            height={50}
            alt="Menu"
            className="w-10 h-10"
          />
        </div>

        {/* Expanded Nav List */}
        <AnimatePresence>
          {isHovered && (
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-white/40 p-1.5 flex flex-col gap-1 overflow-hidden origin-top z-10"
            >
              {navItems.map((item) => renderLink(item, "vertical"))}
            </motion.nav>
          )}
        </AnimatePresence>
      </aside>
      )}

      {/* Mobile bottom navigation */}
      <div className="lg:hidden fixed inset-x-0 bottom-6 flex justify-center z-50 px-4">
        <nav className="w-full max-w-xs bg-white/60 backdrop-blur-md border border-gray-200/40 rounded-3xl shadow-[0_12px_30px_rgba(0,0,0,0.15)] px-2 py-2 flex gap-2">
          {navItems.map((item) => renderLink(item, "horizontal"))}
        </nav>
      </div>
    </>
  );
}


import { ParticipantSearch } from "@/components/participant-search";
import { FestPageHero } from "@/components/FestPageHero";
import { getStudents, getTeams } from "@/lib/data";
import { Search, QrCode, Trophy } from "lucide-react";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Participant Search",
  description: "Find participants by name or chest number. View individual profiles, results, and performance stats.",
};

const FEATURES = [
  { icon: Search, title: "Smart Search", text: "Instantly find participants by typing their name or chest number. Partial matches work too." },
  { icon: QrCode, title: "Quick Scan", text: "Use the built-in QR scanner to pull up a participant's profile from their ID badge. No typing." },
  { icon: Trophy, title: "Live Stats", text: "Real-time point totals, grade breakdowns and performance history for every participant." },
];

export default async function ParticipantSearchPage() {
  const [students, teams] = await Promise.all([getStudents(), getTeams()]);

  return (
    <div className="min-h-screen bg-white">
      <FestPageHero
        eyebrow="Find participants"
        title="Participants"
        subtitle="Search by name or chest number to see profiles, results and points."
        stats={[
          { value: students.length, label: "Participants" },
          { value: teams.length, label: "Teams" },
        ]}
      />

      <div className="container mx-auto px-4 pb-6 pt-2">
        <ParticipantSearch />
      </div>

      <div className="container mx-auto px-4 pb-20 pt-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-[28px] bg-[linear-gradient(135deg,#F0A220_0%,#EC8230_30%,#E4602F_62%,#DB3C3F_100%)] p-6 text-white shadow-[0_6px_0_#A9362B] transition-transform hover:-translate-y-1"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FBFF00] shadow-[0_3px_0_#A9462A] transition-transform group-hover:scale-110">
                <Icon className="h-6 w-6 text-[#C72F36]" />
              </div>
              <h3 className="font-hero-stat text-lg font-extrabold uppercase tracking-tight text-[#FBFF00]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/90">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

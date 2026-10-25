"use client";

import { useRouter } from "next/navigation";
import { useResultUpdates, useScoreboardUpdates } from "@/hooks/use-realtime";
import { useEffect } from "react";

interface RealtimePageWrapperProps {
  children: React.ReactNode;
  refreshOnResults?: boolean;
  refreshOnScoreboard?: boolean;
}

function ResultUpdatesListener({ onUpdate }: { onUpdate: () => void }) {
  useResultUpdates(onUpdate);
  return null;
}

function ScoreboardUpdatesListener({ onUpdate }: { onUpdate: () => void }) {
  useScoreboardUpdates(onUpdate);
  return null;
}

export function RealtimePageWrapper({
  children,
  refreshOnResults = false,
  refreshOnScoreboard = false,
}: RealtimePageWrapperProps) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh();
  };

  return (
    <>
      {refreshOnResults && <ResultUpdatesListener onUpdate={handleUpdate} />}
      {refreshOnScoreboard && <ScoreboardUpdatesListener onUpdate={handleUpdate} />}
      {children}
    </>
  );
}











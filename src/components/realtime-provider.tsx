"use client";

import { useEffect, useState } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import { Wifi, WifiOff } from "lucide-react";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const pusher = getPusherClient();

    const handleConnectionStateChange = (state: string) => {
      setIsConnected(state === "connected" || state === "connecting");
    };

    pusher.connection.bind("state_change", (states: { previous: string; current: string }) => {
      handleConnectionStateChange(states.current);
    });

    handleConnectionStateChange(pusher.connection.state);

    return () => {
      pusher.disconnect();
    };
  }, []);

  return (
    <>
      {children}
      {/* Optional: Show connection status in dev mode */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/90 border border-white/10 px-3 py-2 text-xs">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Real-time Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400">Connecting...</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}











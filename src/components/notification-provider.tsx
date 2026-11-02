"use client";

import { useEffect, useState } from "react";
import { NotificationBell, type NotificationBellVariant } from "./notification-bell";
import type { Notification } from "@/lib/types";

export function NotificationProvider({ variant = "pill" }: { variant?: NotificationBellVariant } = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await fetch("/api/notifications");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotifications();
  }, []);

  // The badge is part of the hero design, so it renders straight away.
  if (isLoading && variant !== "badge") {
    return null;
  }

  return (
    <NotificationBell
      key={isLoading ? "loading" : "ready"}
      variant={variant}
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    />
  );
}


"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, X, ExternalLink, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getPusherClient, CHANNELS } from "@/lib/pusher-client";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
}

export function NotificationBell({
  initialNotifications = [],
  initialUnreadCount = 0,
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const bellRef = useRef<HTMLButtonElement>(null);

  // Listen for new notifications
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(CHANNELS.RESULTS);

    channel.bind("notification-created", (data: { notification: Notification }) => {
      setNotifications((prev) => [data.notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Show browser notification if permission granted
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(data.notification.title, {
          body: data.notification.message,
          icon: "/icon-192x192.png",
          badge: "/icon-96x96.png",
        });
      }
    });

    return () => {
      channel.unbind("notification-created");
      pusher.unsubscribe(CHANNELS.RESULTS);
    };
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    // Navigate to result page first
    router.push(`/results/${notification.programId}`);
    setIsOpen(false);

    // Mark as read after navigation
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "POST",
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }
  }, [router]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, []);

  return (
    <div className="relative">
      <motion.button
        ref={bellRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-3 rounded-full transition-all duration-300",
          "bg-[#F2C04D] backdrop-blur-md shadow-lg border border-white/20",
          "hover:bg-white hover:shadow-xl hover:border-purple-200",
          isOpen && "bg-white ring-2 ring-purple-500/20"
        )}
        aria-label="Notifications"
      >
        <svg
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            "w-5 h-5 transition-colors",
            unreadCount > 0 ? "text-purple-600" : "text-gray-800"
          )}
        >
          <path
            d="M0 17V15H2V8C2 6.61667 2.41667 5.39167 3.25 4.325C4.08333 3.24167 5.16667 2.53333 6.5 2.2V1.5C6.5 1.08333 6.64167 0.733333 6.925 0.449999C7.225 0.15 7.58333 0 8 0C8.41667 0 8.76667 0.15 9.05 0.449999C9.35 0.733333 9.5 1.08333 9.5 1.5V2.2C10.8333 2.53333 11.9167 3.24167 12.75 4.325C13.5833 5.39167 14 6.61667 14 8V15H16V17H0ZM8 20C7.45 20 6.975 19.8083 6.575 19.425C6.19167 19.025 6 18.55 6 18H10C10 18.55 9.8 19.025 9.4 19.425C9.01667 19.8083 8.55 20 8 20ZM4 15H12V8C12 6.9 11.6083 5.95833 10.825 5.175C10.0417 4.39167 9.1 4 8 4C6.9 4 5.95833 4.39167 5.175 5.175C4.39167 5.95833 4 6.9 4 8V15Z"
            fill="currentColor"
          />
        </svg>

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 shadow-sm border-2 border-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95, transformOrigin: "top right" }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 md:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 z-50 max-h-[600px] overflow-hidden flex flex-col ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 text-lg">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Bell className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-900 font-medium">No notifications yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      We'll let you know when results are published!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "p-4 cursor-pointer transition-all hover:bg-gray-50 group relative",
                          !notification.read && "bg-purple-50/40 hover:bg-purple-50/60"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-colors",
                            !notification.read ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" : "bg-gray-200"
                          )} />

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <p className={cn(
                                "text-sm font-semibold leading-tight",
                                !notification.read ? "text-gray-900" : "text-gray-700"
                              )}>
                                {notification.title}
                              </p>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                              {notification.message}
                            </p>

                            <div className="flex items-center gap-1 text-xs text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                              <span>View Results</span>
                              <ExternalLink className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useCallback, useRef } from "react";
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher-client";
import { useRouter } from "next/navigation";

type EventCallback = (data: any) => void;

// Global refresh lock to prevent multiple simultaneous refreshes across all hooks
let isRefreshing = false;
let refreshTimeout: NodeJS.Timeout | null = null;
let pendingRefresh = false;

export function useRealtimeSubscription(
  channelName: string,
  eventName: string,
  callback: EventCallback,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);
  const router = useRouter();

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(channelName);

    const handler = (data: any) => {
      // Call the callback immediately - data arrives in real-time
      callbackRef.current(data);
      
      // Deduplicate refresh calls - only refresh if not already refreshing
      if (!isRefreshing) {
        isRefreshing = true;
        pendingRefresh = false;
        
        // Clear any pending refresh timeout
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        
        // Refresh immediately
        router.refresh();
        
        // Reset the lock after a short delay to allow refresh to complete
        // This prevents multiple rapid refreshes while still being responsive
        refreshTimeout = setTimeout(() => {
          isRefreshing = false;
          // If there was a pending refresh, trigger it now
          if (pendingRefresh) {
            pendingRefresh = false;
            router.refresh();
            setTimeout(() => {
              isRefreshing = false;
            }, 200);
          }
        }, 300);
      } else {
        // Mark that we need to refresh after current one completes
        pendingRefresh = true;
      }
    };

    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
      pusher.unsubscribe(channelName);
      // Clean up timeout on unmount
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    };
  }, [channelName, eventName, router]);

  const refresh = useCallback(() => {
    if (!isRefreshing) {
      isRefreshing = true;
      router.refresh();
      setTimeout(() => {
        isRefreshing = false;
      }, 200);
    }
  }, [router]);

  return { refresh };
}

// Specific hooks for different use cases
export function useResultUpdates(onUpdate: () => void) {
  useRealtimeSubscription(CHANNELS.RESULTS, EVENTS.RESULT_APPROVED, onUpdate);
  useRealtimeSubscription(CHANNELS.RESULTS, EVENTS.RESULT_REJECTED, onUpdate);
  useRealtimeSubscription(CHANNELS.RESULTS, EVENTS.RESULT_SUBMITTED, onUpdate);
  useRealtimeSubscription(CHANNELS.RESULTS, EVENTS.RESULT_UPDATED, onUpdate);
}

export function useAssignmentUpdates(onUpdate: () => void) {
  useRealtimeSubscription(CHANNELS.ASSIGNMENTS, EVENTS.ASSIGNMENT_CREATED, onUpdate);
  useRealtimeSubscription(CHANNELS.ASSIGNMENTS, EVENTS.ASSIGNMENT_DELETED, onUpdate);
}

export function useRegistrationUpdates(onUpdate: () => void) {
  useRealtimeSubscription(CHANNELS.REGISTRATIONS, EVENTS.REGISTRATION_CREATED, onUpdate);
  useRealtimeSubscription(CHANNELS.REGISTRATIONS, EVENTS.REGISTRATION_DELETED, onUpdate);
}

export function useStudentUpdates(onUpdate: () => void) {
  useRealtimeSubscription(CHANNELS.STUDENTS, EVENTS.STUDENT_CREATED, onUpdate);
  useRealtimeSubscription(CHANNELS.STUDENTS, EVENTS.STUDENT_UPDATED, onUpdate);
  useRealtimeSubscription(CHANNELS.STUDENTS, EVENTS.STUDENT_DELETED, onUpdate);
}

export function useScoreboardUpdates(onUpdate: () => void) {
  useRealtimeSubscription(CHANNELS.SCOREBOARD, EVENTS.SCOREBOARD_UPDATED, onUpdate);
}




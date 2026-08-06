"use client";

import { useEffect } from "react";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase, isSupabaseConnected } from "@/lib/supabase";

interface UseRealtimeSubscriptionProps<T extends Record<string, any>> {
  table: string;
  schema?: string;
  filter?: string;
  onInsert?: (newRecord: T) => void;
  onUpdate?: (updatedRecord: T) => void;
  onDelete?: (deletedRecord: Partial<T>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

export function useRealtimeSubscription<T extends Record<string, any>>({
  table,
  schema = "public",
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true
}: UseRealtimeSubscriptionProps<T>) {
  useEffect(() => {
    if (!enabled || !isSupabaseConnected()) return;

    const channelName = `realtime-${table}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema,
          table,
          ...(filter ? { filter } : {})
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (onChange) {
            onChange(payload);
          }

          if (payload.eventType === "INSERT" && onInsert && payload.new) {
            onInsert(payload.new as T);
          } else if (payload.eventType === "UPDATE" && onUpdate && payload.new) {
            onUpdate(payload.new as T);
          } else if (payload.eventType === "DELETE" && onDelete && payload.old) {
            onDelete(payload.old as Partial<T>);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Supabase Realtime] Subscribed to table '${table}'`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, schema, filter, enabled, onInsert, onUpdate, onDelete, onChange]);
}

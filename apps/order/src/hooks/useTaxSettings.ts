/**
 * @tepisawah/order — hook to sync tax, QRIS and merchant settings
 * in real-time on customer checkout screens.
 */

import { useState, useEffect } from "react";
import { loadTaxSettings, syncTaxSettingsFromDb, type TaxSettings } from "@tepisawah/config";
import { getSupabaseClient } from "../lib/supabase.js";

export function useTaxSettings(): TaxSettings {
  const [settings, setSettings] = useState<TaxSettings>(() => loadTaxSettings());

  useEffect(() => {
    let active = true;

    // Safely obtain client (in test environments without env vars, silently fallback to local)
    let client: ReturnType<typeof getSupabaseClient> | null = null;
    try {
      client = getSupabaseClient();
    } catch {
      client = null;
    }

    if (!client) {
      return;
    }

    // 1. Initial fetch from Supabase to sync settings (including restaurant QRIS image)
    const syncFromDb = async () => {
      try {
        if (!client) return;
        const { data, error } = await client
          .from("tax_settings")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error && active) {
          const synced = syncTaxSettingsFromDb(data as Record<string, unknown>);
          setSettings(synced);
        }
      } catch (err) {
        // Fallback silently to default/localStorage settings
        console.warn("Gagal sinkronisasi tax_settings pada order app:", err);
      }
    };

    void syncFromDb();

    // 2. Realtime subscription: updates from Admin immediately reflect on customer screen.
    // Use an isolated unique channel name per hook instance to prevent duplicate channel collision.
    let channel: ReturnType<typeof client.channel> | null = null;
    try {
      const channelName = `order_tax_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      channel = client
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tax_settings" },
          (payload) => {
            if (payload.new && active) {
              const synced = syncTaxSettingsFromDb(payload.new as Record<string, unknown>);
              setSettings(synced);
            }
          }
        );
      channel.subscribe();
    } catch (err) {
      console.warn("Realtime tax_settings order subscription failed, continuing with cached settings:", err);
    }

    // 3. Storage event listener for same-device multi-tab sync
    const handleStorage = () => {
      if (active) {
        setSettings(loadTaxSettings());
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      if (channel && client) {
        try {
          void client.removeChannel(channel);
        } catch {
          // Ignore disposal errors
        }
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return settings;
}

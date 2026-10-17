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

    // 2. Realtime subscription: updates from Admin immediately reflect on customer screen
    const channel = client
      .channel("tax_settings_order_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tax_settings" },
        (payload) => {
          if (payload.new && active) {
            const synced = syncTaxSettingsFromDb(payload.new as Record<string, unknown>);
            setSettings(synced);
          }
        }
      )
      .subscribe();

    // 3. Storage event listener for same-device multi-tab sync
    const handleStorage = () => {
      if (active) {
        setSettings(loadTaxSettings());
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      if (client) {
        void client.removeChannel(channel);
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return settings;
}

/**
 * @tepisawah/pos — hook to keep tax, QRIS, bank and printer settings synced
 * across all cashier POS terminals and devices in real-time.
 */

import { useState, useEffect } from "react";
import { loadTaxSettings, syncTaxSettingsFromDb, type TaxSettings } from "@tepisawah/config";
import { getSupabaseClient } from "../lib/supabase.js";

export function useTaxSettings(): TaxSettings {
  const [settings, setSettings] = useState<TaxSettings>(() => loadTaxSettings());

  useEffect(() => {
    let active = true;

    // 1. Initial fetch from Supabase to sync settings (including QRIS image) across devices
    const syncFromDb = async () => {
      try {
        const client = getSupabaseClient();
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
        // Fallback silently to localStorage
        console.warn("Gagal sinkronisasi tax_settings dari Supabase:", err);
      }
    };

    void syncFromDb();

    // 2. Realtime subscription: updates from Admin immediately propagate to this POS device
    const client = getSupabaseClient();
    const channel = client
      .channel("tax_settings_pos_sync")
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

    // 3. Local events for cross-tab or same-window updates
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent<TaxSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(loadTaxSettings());
      }
    };

    window.addEventListener("tepisawah:tax_settings_changed", handleLocalChange);
    window.addEventListener("storage", handleLocalChange);

    return () => {
      active = false;
      void client.removeChannel(channel);
      window.removeEventListener("tepisawah:tax_settings_changed", handleLocalChange);
      window.removeEventListener("storage", handleLocalChange);
    };
  }, []);

  return settings;
}

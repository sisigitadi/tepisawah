/**
 * @tepisawah/admin — `settings` feature.
 *
 * Phase 4: restaurant settings + operating hours retrieval/update.
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §35, §43).
 */

export { SettingsPage } from "./settings-page.js";
export { OperatingHoursForm } from "./operating-hours-form.js";
export { RestaurantSettingsForm } from "./restaurant-settings-form.js";
export {
  DAY_OF_WEEK_LABELS,
  toHoursInputs,
  toHoursRows,
  toSettingsForm,
  toSettingsInput,
} from "./use-settings.js";
export {
  loadSettings,
  saveHours,
  saveSettings,
  type HoursSaveResult,
  type SettingsSaveResult,
  type SettingsSnapshot,
} from "./service.js";

/**
 * @tepisawah/web - Dynamic Theme and Background Injector.
 *
 * Injects CSS variables and custom background styling configured via the Staff Portal CMS.
 * Supports presets (Default, Sunset, Fresh Emerald, Dark Moss) and full custom color palettes.
 */
import { useEffect, type ReactNode } from "react";
import { useLandingContent } from "../../../hooks/index.js";

export function ThemeInjector(): ReactNode {
  const { content } = useLandingContent();
  const theme = content.theme;

  useEffect(() => {
    if (!theme) return;

    let styleEl = document.getElementById("tepisawah-dynamic-theme") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "tepisawah-dynamic-theme";
      document.head.appendChild(styleEl);
    }

    const customBgCss =
      theme.bgType === "custom_image" && theme.bgImageUrl
        ? `
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          background-image: url('${theme.bgImageUrl}');
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          opacity: ${theme.bgOpacity ?? 0.15};
          pointer-events: none;
        }
        body {
          position: relative;
        }
      `
        : theme.bgType === "texture"
        ? `
        body {
          background-image: radial-gradient(rgba(24, 58, 29, 0.06) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }
        body::before {
          display: none;
        }
      `
        : `
        body {
          background-image: none;
        }
        body::before {
          display: none;
        }
      `;

    styleEl.textContent = `
      :root {
        --c-deepmoss: ${theme.primaryColor || "#183a1d"};
        --c-forest: ${theme.secondaryColor || "#2e6b34"};
        --c-golden: ${theme.accentColor || "#dda15e"};
        --c-amberwarm: ${theme.amberColor || "#f3c644"};
        --c-warmcream: ${theme.backgroundColor || "#fefae0"};
        --c-ricepaper: ${theme.panelBgColor || "#f8f4db"};
        --c-roastedearth: ${theme.textColor || "#3d1f10"};
      }
      ${customBgCss}
    `;
  }, [theme]);

  return null;
}

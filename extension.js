// GTK3 Theme Switcher — based on gtk3-auto-dark by Sebastian Wiesner
// Extended to support custom GTK3 themes (e.g. adw-gtk3) and icon theme switching.
//
// Original code licensed under MPL 2.0 / GPL 2+
// https://codeberg.org/swsnr/gnome-shell-extension-gtk3-auto-dark

import Gio from "gi://Gio";
import { DestructibleExtension } from "./lib/destructible.js";

/**
 * Apply GTK3 theme and optionally icon theme based on the current color scheme.
 *
 * @param {object} log       - Logger from DestructibleExtension
 * @param {Gio.Settings} iface - org.gnome.desktop.interface settings
 * @param {Gio.Settings} ext  - Extension settings
 */
const applyThemes = (log, iface, ext) => {
    const scheme = iface.get_string("color-scheme");
    const isDark = scheme === "prefer-dark";

    // ── GTK3 theme ────────────────────────────────────────────────────────
    if (isDark) {
        const darkTheme = ext.get_string("gtk3-dark-theme").trim();
        const theme = darkTheme || "Adwaita-dark";
        log.log(`Dark mode: setting GTK3 theme to "${theme}"`);
        iface.set_string("gtk-theme", theme);
    } else {
        const lightTheme = ext.get_string("gtk3-light-theme").trim();
        if (lightTheme) {
            log.log(`Light mode: setting GTK3 theme to "${lightTheme}"`);
            iface.set_string("gtk-theme", lightTheme);
        } else {
            log.log("Light mode: resetting GTK3 theme to system default");
            iface.reset("gtk-theme");
        }
    }

    // ── Icon theme (optional) ─────────────────────────────────────────────
    const manageIcons = ext.get_boolean("manage-icon-theme");
    if (!manageIcons) return;

    if (isDark) {
        const darkIcon = ext.get_string("icon-dark-theme").trim();
        if (darkIcon) {
            log.log(`Dark mode: setting icon theme to "${darkIcon}"`);
            iface.set_string("icon-theme", darkIcon);
        }
    } else {
        const lightIcon = ext.get_string("icon-light-theme").trim();
        if (lightIcon) {
            log.log(`Light mode: setting icon theme to "${lightIcon}"`);
            iface.set_string("icon-theme", lightIcon);
        }
    }
};

export default class Gtk3ThemeSwitcher extends DestructibleExtension {
    initialize(destroyer) {
        const log = this.getLogger();
        const iface = Gio.Settings.new("org.gnome.desktop.interface");
        const ext = this.getSettings();

        // Re-apply whenever the system color scheme changes.
        destroyer.addSignal(
            iface,
            iface.connect("changed::color-scheme", () => applyThemes(log, iface, ext))
        );

        // Re-apply whenever the user updates extension settings (e.g. from prefs).
        destroyer.addSignal(
            ext,
            ext.connect("changed", () => applyThemes(log, iface, ext))
        );

        // Apply immediately on enable.
        applyThemes(log, iface, ext);
    }
}

// GTK3 Theme Switcher — based on gtk3-auto-dark by Sebastian Wiesner
// Extended to support custom GTK3/icon/Kvantum themes.
//
// Original code licensed under MPL 2.0 / GPL 2+
// https://codeberg.org/swsnr/gnome-shell-extension-gtk3-auto-dark

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { DestructibleExtension } from "./lib/destructible.js";

// ── Kvantum config helpers ────────────────────────────────────────────────────

const KVANTUM_CONFIG_PATH = `${GLib.get_home_dir()}/.config/Kvantum/kvantum.kvconfig`;

/**
 * Read the current Kvantum config file as a string, or "" if absent.
 */
function readKvantumConfig() {
    try {
        const [ok, contents] = GLib.file_get_contents(KVANTUM_CONFIG_PATH);
        if (ok) return new TextDecoder().decode(contents);
    } catch (_) {}
    return "";
}

/**
 * Set the Kvantum theme by rewriting the theme= key in [General].
 * Preserves any other sections/keys already present.
 *
 * @param {string} themeName
 */
function setKvantumTheme(themeName) {
    let config = readKvantumConfig();

    if (config.includes("[General]")) {
        if (/^theme\s*=/m.test(config)) {
            // Replace existing theme= line.
            config = config.replace(/^theme\s*=.*$/m, `theme=${themeName}`);
        } else {
            // Insert theme= right after [General].
            config = config.replace("[General]", `[General]\ntheme=${themeName}`);
        }
    } else {
        // No [General] section — prepend one.
        config = `[General]\ntheme=${themeName}\n\n${config}`;
    }

    // Ensure parent directory exists.
    const dir = GLib.path_get_dirname(KVANTUM_CONFIG_PATH);
    GLib.mkdir_with_parents(dir, 0o755);

    // Write atomically via GLib (simpler and more reliable in GJS than Gio).
    const [ok, err] = GLib.file_set_contents(KVANTUM_CONFIG_PATH, config);
    if (!ok) throw new Error(err ? err.message : "GLib.file_set_contents failed");
}

// ── Main theme application ────────────────────────────────────────────────────

/**
 * Apply GTK3, icon, and Kvantum themes based on the current color scheme.
 *
 * @param {object}       log   - Logger from DestructibleExtension
 * @param {Gio.Settings} iface - org.gnome.desktop.interface settings
 * @param {Gio.Settings} ext   - Extension settings
 */
const applyThemes = (log, iface, ext) => {
    const scheme = iface.get_string("color-scheme");
    const isDark = scheme === "prefer-dark";

    // ── GTK3 theme ────────────────────────────────────────────────────────
    if (isDark) {
        const theme = ext.get_string("gtk3-dark-theme").trim() || "Adwaita-dark";
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
    if (ext.get_boolean("manage-icon-theme")) {
        const iconTheme = isDark
            ? ext.get_string("icon-dark-theme").trim()
            : ext.get_string("icon-light-theme").trim();
        if (iconTheme) {
            log.log(`Setting icon theme to "${iconTheme}"`);
            iface.set_string("icon-theme", iconTheme);
        }
    }

    // ── Kvantum theme (optional) ──────────────────────────────────────────
    if (ext.get_boolean("manage-kvantum-theme")) {
        const kvTheme = isDark
            ? ext.get_string("kvantum-dark-theme").trim()
            : ext.get_string("kvantum-light-theme").trim();
        if (kvTheme) {
            try {
                log.log(`Setting Kvantum theme to "${kvTheme}"`);
                setKvantumTheme(kvTheme);
            } catch (e) {
                log.error(`Failed to set Kvantum theme: ${e.message}`);
            }
        }
    }
};

// ── Extension class ───────────────────────────────────────────────────────────

export default class Gtk3ThemeSwitcher extends DestructibleExtension {
    initialize(destroyer) {
        const log = this.getLogger();
        const iface = Gio.Settings.new("org.gnome.desktop.interface");
        const ext = this.getSettings();

        destroyer.addSignal(
            iface,
            iface.connect("changed::color-scheme", () => applyThemes(log, iface, ext))
        );

        destroyer.addSignal(
            ext,
            ext.connect("changed", () => applyThemes(log, iface, ext))
        );

        applyThemes(log, iface, ext);
    }
}

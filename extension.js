// GTK3 Theme Switcher — based on gtk3-auto-dark by Sebastian Wiesner
// Extended to support custom GTK3/icon/Kvantum themes and wallpaper switching.
//
// Original code licensed under MPL 2.0 / GPL 2+
// https://codeberg.org/swsnr/gnome-shell-extension-gtk3-auto-dark

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { DestructibleExtension } from "./lib/destructible.js";

// ── Kvantum helpers ───────────────────────────────────────────────────────────

const KVANTUM_CONFIG_PATH = `${GLib.get_home_dir()}/.config/Kvantum/kvantum.kvconfig`;

function readKvantumConfig() {
    try {
        const [ok, contents] = GLib.file_get_contents(KVANTUM_CONFIG_PATH);
        if (ok) return new TextDecoder().decode(contents);
    } catch (_) {}
    return "";
}

function setKvantumTheme(themeName) {
    let config = readKvantumConfig();

    if (config.includes("[General]")) {
        if (/^theme\s*=/m.test(config)) {
            config = config.replace(/^theme\s*=.*$/m, `theme=${themeName}`);
        } else {
            config = config.replace("[General]", `[General]\ntheme=${themeName}`);
        }
    } else {
        config = `[General]\ntheme=${themeName}\n\n${config}`;
    }

    GLib.mkdir_with_parents(GLib.path_get_dirname(KVANTUM_CONFIG_PATH), 0o755);
    const [ok] = GLib.file_set_contents(KVANTUM_CONFIG_PATH, config);
    if (!ok) throw new Error("GLib.file_set_contents failed");
}

// ── Main theme application ────────────────────────────────────────────────────

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

    // ── Icon theme ────────────────────────────────────────────────────────
    if (ext.get_boolean("manage-icon-theme")) {
        const iconTheme = isDark
            ? ext.get_string("icon-dark-theme").trim()
            : ext.get_string("icon-light-theme").trim();
        if (iconTheme) {
            log.log(`Setting icon theme to "${iconTheme}"`);
            iface.set_string("icon-theme", iconTheme);
        }
    }

    // ── Kvantum theme ─────────────────────────────────────────────────────
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

    // ── Wallpaper ─────────────────────────────────────────────────────────
    if (ext.get_boolean("manage-wallpaper")) {
        const uri = isDark
            ? ext.get_string("wallpaper-dark-uri").trim()
            : ext.get_string("wallpaper-light-uri").trim();
        if (uri) {
            try {
                log.log(`Setting wallpaper to "${uri}"`);
                const bg = Gio.Settings.new("org.gnome.desktop.background");
                // Set picture-uri (all GNOME versions) and picture-uri-dark
                // (GNOME 42+, used when the shell itself is in dark mode).
                bg.set_string("picture-uri", uri);
                bg.set_string("picture-uri-dark", uri);
            } catch (e) {
                log.error(`Failed to set wallpaper: ${e.message}`);
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

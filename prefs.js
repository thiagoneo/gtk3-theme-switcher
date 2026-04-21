// GTK3 Theme Switcher — Preferences
//
// Provides a GUI to choose GTK3 themes and icon themes for light and dark modes.

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// ── Theme discovery ───────────────────────────────────────────────────────────

/**
 * Enumerate child directory names inside `dir` that satisfy `predicate`.
 *
 * @param {string} dir
 * @param {(name: string, dir: string) => boolean} predicate
 * @returns {string[]}
 */
function listDirEntries(dir, predicate) {
    const results = [];
    try {
        const gdir = Gio.File.new_for_path(dir);
        const enumerator = gdir.enumerate_children(
            "standard::name,standard::type",
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                const name = info.get_name();
                if (predicate(name, dir)) results.push(name);
            }
        }
    } catch (_) {
        // Directory doesn't exist or isn't readable — skip silently.
    }
    return results;
}

/** Return a sorted, deduplicated list of installed GTK3 themes. */
function getGtk3Themes() {
    const found = new Set(["Adwaita", "Adwaita-dark", "HighContrast", "HighContrastInverse"]);
    const dirs = [
        `${GLib.get_home_dir()}/.themes`,
        "/usr/share/themes",
        `${GLib.get_user_data_dir()}/themes`,
    ];
    const hasGtk3 = (name, base) =>
        Gio.File.new_for_path(`${base}/${name}/gtk-3.0`).query_exists(null);

    for (const d of dirs)
        listDirEntries(d, (n) => hasGtk3(n, d)).forEach((n) => found.add(n));

    return [...found].sort();
}

/** Return a sorted, deduplicated list of installed icon themes. */
function getIconThemes() {
    const found = new Set(["Adwaita", "hicolor"]);
    const dirs = [
        `${GLib.get_home_dir()}/.icons`,
        "/usr/share/icons",
        `${GLib.get_user_data_dir()}/icons`,
        `${GLib.get_home_dir()}/.local/share/icons`,
    ];
    const hasIndex = (name, base) =>
        Gio.File.new_for_path(`${base}/${name}/index.theme`).query_exists(null);

    for (const d of dirs)
        listDirEntries(d, (n) => hasIndex(n, d)).forEach((n) => found.add(n));

    return [...found].sort();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build an Adw.ComboRow backed by a string list.
 * The first entry is always a placeholder "(default / do not change)" item
 * that maps to the empty string in settings.
 *
 * @param {object} opts
 * @param {string}   opts.title
 * @param {string}   opts.subtitle
 * @param {string[]} opts.items        - Actual theme names (non-empty strings)
 * @param {string}   opts.placeholder  - Label for the empty/default choice
 * @param {string}   opts.currentValue - Currently stored settings value
 * @param {(val: string) => void} opts.onChange
 * @returns {Adw.ComboRow}
 */
function makeComboRow({ title, subtitle, items, placeholder, currentValue, onChange }) {
    const labels = [placeholder, ...items];
    const model = new Gtk.StringList();
    labels.forEach((l) => model.append(l));

    const row = new Adw.ComboRow({ title, subtitle, model });

    // Select the stored value, defaulting to index 0 (placeholder) if not found.
    const idx = items.indexOf(currentValue);
    row.set_selected(idx >= 0 ? idx + 1 : 0);

    row.connect("notify::selected", () => {
        const sel = row.get_selected();
        onChange(sel === 0 ? "" : items[sel - 1]);
    });

    return row;
}

// ── Preferences window ────────────────────────────────────────────────────────

export default class Gtk3ThemeSwitcherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const gtkThemes = getGtk3Themes();
        const iconThemes = getIconThemes();

        window.set_default_size(640, 480);

        const page = new Adw.PreferencesPage({
            title: "Settings",
            icon_name: "preferences-desktop-theme-symbolic",
        });
        window.add(page);

        // ── GTK3 Theme group ──────────────────────────────────────────────
        const gtkGroup = new Adw.PreferencesGroup({
            title: "GTK3 Theme",
            description:
                "Choose which GTK3 theme is applied for each color scheme. " +
                "Install adw-gtk3 to make GTK3 apps look like native GNOME 4x apps.",
        });
        page.add(gtkGroup);

        const darkGtkRow = makeComboRow({
            title: "Dark theme",
            subtitle: 'Applied when the system color scheme is "prefer-dark"',
            items: gtkThemes,
            placeholder: "(default: Adwaita-dark)",
            currentValue: settings.get_string("gtk3-dark-theme"),
            onChange: (v) => settings.set_string("gtk3-dark-theme", v),
        });
        gtkGroup.add(darkGtkRow);

        const lightGtkRow = makeComboRow({
            title: "Light theme",
            subtitle: "Applied when the system color scheme is light",
            items: gtkThemes,
            placeholder: "(system default)",
            currentValue: settings.get_string("gtk3-light-theme"),
            onChange: (v) => settings.set_string("gtk3-light-theme", v),
        });
        gtkGroup.add(lightGtkRow);

        // ── Icon Theme group ──────────────────────────────────────────────
        const iconGroup = new Adw.PreferencesGroup({
            title: "Icon Theme",
            description:
                "Optionally switch the icon theme together with the color scheme. " +
                "Useful if your icon theme has separate light/dark variants (e.g. Papirus / Papirus-Dark).",
        });
        page.add(iconGroup);

        const manageIconRow = new Adw.SwitchRow({
            title: "Switch icon theme automatically",
            subtitle: "Enable to also swap icon themes on color scheme changes",
        });
        settings.bind(
            "manage-icon-theme",
            manageIconRow,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );
        iconGroup.add(manageIconRow);

        const darkIconRow = makeComboRow({
            title: "Dark icon theme",
            subtitle: 'Applied when the system color scheme is "prefer-dark"',
            items: iconThemes,
            placeholder: "(do not change)",
            currentValue: settings.get_string("icon-dark-theme"),
            onChange: (v) => settings.set_string("icon-dark-theme", v),
        });
        iconGroup.add(darkIconRow);

        const lightIconRow = makeComboRow({
            title: "Light icon theme",
            subtitle: "Applied when the system color scheme is light",
            items: iconThemes,
            placeholder: "(do not change)",
            currentValue: settings.get_string("icon-light-theme"),
            onChange: (v) => settings.set_string("icon-light-theme", v),
        });
        iconGroup.add(lightIconRow);

        // Grey-out icon rows when the toggle is off.
        const syncIconSensitivity = () => {
            const on = settings.get_boolean("manage-icon-theme");
            darkIconRow.sensitive = on;
            lightIconRow.sensitive = on;
        };
        syncIconSensitivity();
        settings.connect("changed::manage-icon-theme", syncIconSensitivity);
    }
}

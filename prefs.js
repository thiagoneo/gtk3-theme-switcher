// GTK3 Theme Switcher — Preferences

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// ── Theme discovery ───────────────────────────────────────────────────────────

/**
 * List immediate child directory names of `dir`.
 * Returns [] if the directory does not exist or is unreadable.
 */
function listSubdirs(dir) {
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
            if (info.get_file_type() === Gio.FileType.DIRECTORY)
                results.push(info.get_name());
        }
    } catch (_) {}
    return results;
}

/**
 * List the stems of all *.kvconfig files immediately inside `dir`.
 * E.g. dir="…/KvLibadwaita" yields ["KvLibadwaita", "KvLibadwaitaDark"].
 */
function listKvconfigStems(dir) {
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
            if (info.get_file_type() === Gio.FileType.REGULAR) {
                const name = info.get_name();
                if (name.endsWith(".kvconfig"))
                    results.push(name.slice(0, -".kvconfig".length));
            }
        }
    } catch (_) {}
    return results;
}

function fileExists(path) {
    return Gio.File.new_for_path(path).query_exists(null);
}

/** Sorted, deduplicated list of installed GTK3 themes. */
function getGtk3Themes() {
    const found = new Set(["Adwaita", "Adwaita-dark", "HighContrast", "HighContrastInverse"]);
    const dirs = [
        `${GLib.get_home_dir()}/.themes`,
        "/usr/share/themes",
        `${GLib.get_user_data_dir()}/themes`,
    ];
    for (const d of dirs)
        listSubdirs(d)
            .filter((n) => fileExists(`${d}/${n}/gtk-3.0`))
            .forEach((n) => found.add(n));
    return [...found].sort();
}

/** Sorted, deduplicated list of installed icon themes. */
function getIconThemes() {
    const found = new Set(["Adwaita", "hicolor"]);
    const dirs = [
        `${GLib.get_home_dir()}/.icons`,
        `${GLib.get_home_dir()}/.local/share/icons`,
        "/usr/share/icons",
    ];
    for (const d of dirs)
        listSubdirs(d)
            .filter((n) => fileExists(`${d}/${n}/index.theme`))
            .forEach((n) => found.add(n));
    return [...found].sort();
}

/**
 * Sorted, deduplicated list of installed Kvantum themes.
 *
 * Kvantum themes can be organised in two ways inside a search directory:
 *   1. Each theme in its own same-named folder:
 *      KvArc/KvArc.kvconfig
 *   2. Multiple variants grouped inside one folder:
 *      KvLibadwaita/KvLibadwaita.kvconfig
 *      KvLibadwaita/KvLibadwaitaDark.kvconfig   ← different name!
 *
 * We handle both by scanning every *.kvconfig file inside every subdir.
 */
function getKvantumThemes() {
    const found = new Set();
    const dirs = [
        `${GLib.get_home_dir()}/.config/Kvantum`,
        `${GLib.get_home_dir()}/.local/share/Kvantum`,
        "/usr/share/Kvantum",
    ];
    for (const d of dirs) {
        for (const subdir of listSubdirs(d)) {
            // Skip the Colors directory (not a theme).
            if (subdir === "Colors") continue;
            const stems = listKvconfigStems(`${d}/${subdir}`);
            stems.forEach((s) => found.add(s));
        }
    }
    return [...found].sort();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build an Adw.ComboRow backed by a string list.
 * Index 0 is always the placeholder (maps to "" in settings).
 */
function makeComboRow({ title, subtitle, items, placeholder, currentValue, onChange }) {
    const labels = [placeholder, ...items];
    const model = new Gtk.StringList();
    labels.forEach((l) => model.append(l));

    const row = new Adw.ComboRow({ title, subtitle, model });

    const idx = items.indexOf(currentValue);
    row.set_selected(idx >= 0 ? idx + 1 : 0);

    row.connect("notify::selected", () => {
        const sel = row.get_selected();
        onChange(sel === 0 ? "" : items[sel - 1]);
    });

    return row;
}

/** Build an Adw.SwitchRow bound to a boolean settings key. */
function makeSwitchRow(settings, { title, subtitle, key }) {
    const row = new Adw.SwitchRow({ title, subtitle });
    settings.bind(key, row, "active", Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/** Grey-out `rows` whenever the boolean settings `key` is false. */
function syncSensitivity(settings, key, rows) {
    const update = () => {
        const on = settings.get_boolean(key);
        for (const r of rows) r.sensitive = on;
    };
    update();
    settings.connect(`changed::${key}`, update);
}

// ── Preferences window ────────────────────────────────────────────────────────

export default class Gtk3ThemeSwitcherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const gtkThemes     = getGtk3Themes();
        const iconThemes    = getIconThemes();
        const kvantumThemes = getKvantumThemes();

        window.set_default_size(640, 580);

        const page = new Adw.PreferencesPage({
            title: "Settings",
            icon_name: "preferences-desktop-theme-symbolic",
        });
        window.add(page);

        // ── GTK3 Theme ────────────────────────────────────────────────────
        const gtkGroup = new Adw.PreferencesGroup({
            title: "GTK3 Theme",
            description:
                "Theme applied to legacy GTK3 apps. Install adw-gtk3 to make " +
                "them look like native GNOME 4x / libadwaita apps.",
        });
        page.add(gtkGroup);

        gtkGroup.add(makeComboRow({
            title: "Dark theme",
            subtitle: 'Applied when the system color scheme is "prefer-dark"',
            items: gtkThemes,
            placeholder: "(default: Adwaita-dark)",
            currentValue: settings.get_string("gtk3-dark-theme"),
            onChange: (v) => settings.set_string("gtk3-dark-theme", v),
        }));

        gtkGroup.add(makeComboRow({
            title: "Light theme",
            subtitle: "Applied when the system color scheme is light",
            items: gtkThemes,
            placeholder: "(system default)",
            currentValue: settings.get_string("gtk3-light-theme"),
            onChange: (v) => settings.set_string("gtk3-light-theme", v),
        }));

        // ── Icon Theme ────────────────────────────────────────────────────
        const iconGroup = new Adw.PreferencesGroup({
            title: "Icon Theme",
            description:
                "Swap icon themes with the color scheme. Useful for themes " +
                "that ship separate light/dark variants (e.g. Papirus / Papirus-Dark).",
        });
        page.add(iconGroup);

        const manageIconRow = makeSwitchRow(settings, {
            title: "Switch icon theme automatically",
            subtitle: "Enable to also swap icon themes on color scheme changes",
            key: "manage-icon-theme",
        });
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

        syncSensitivity(settings, "manage-icon-theme", [darkIconRow, lightIconRow]);

        // ── Kvantum Theme ─────────────────────────────────────────────────
        const kvDesc = kvantumThemes.length === 0
            ? "No Kvantum themes detected. Install themes under ~/.config/Kvantum/ or /usr/share/Kvantum/."
            : `${kvantumThemes.length} Kvantum theme(s) detected. Writes the chosen theme to ~/.config/Kvantum/kvantum.kvconfig.`;

        const kvGroup = new Adw.PreferencesGroup({
            title: "Kvantum Theme (Qt apps)",
            description: kvDesc,
        });
        page.add(kvGroup);

        const manageKvRow = makeSwitchRow(settings, {
            title: "Switch Kvantum theme automatically",
            subtitle: "Updates kvantum.kvconfig when the color scheme changes",
            key: "manage-kvantum-theme",
        });
        kvGroup.add(manageKvRow);

        const darkKvRow = makeComboRow({
            title: "Dark Kvantum theme",
            subtitle: 'Applied when the system color scheme is "prefer-dark"',
            items: kvantumThemes,
            placeholder: "(do not change)",
            currentValue: settings.get_string("kvantum-dark-theme"),
            onChange: (v) => settings.set_string("kvantum-dark-theme", v),
        });
        kvGroup.add(darkKvRow);

        const lightKvRow = makeComboRow({
            title: "Light Kvantum theme",
            subtitle: "Applied when the system color scheme is light",
            items: kvantumThemes,
            placeholder: "(do not change)",
            currentValue: settings.get_string("kvantum-light-theme"),
            onChange: (v) => settings.set_string("kvantum-light-theme", v),
        });
        kvGroup.add(lightKvRow);

        syncSensitivity(settings, "manage-kvantum-theme", [darkKvRow, lightKvRow]);
    }
}

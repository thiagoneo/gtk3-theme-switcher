// GTK3 Theme Switcher — Preferences

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// ── Theme discovery ───────────────────────────────────────────────────────────

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

function getKvantumThemes() {
    const found = new Set();
    const dirs = [
        `${GLib.get_home_dir()}/.config/Kvantum`,
        `${GLib.get_home_dir()}/.local/share/Kvantum`,
        "/usr/share/Kvantum",
    ];
    for (const d of dirs) {
        for (const subdir of listSubdirs(d)) {
            if (subdir === "Colors") continue;
            listKvconfigStems(`${d}/${subdir}`).forEach((s) => found.add(s));
        }
    }
    return [...found].sort();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

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

function makeSwitchRow(settings, { title, subtitle, key }) {
    const row = new Adw.SwitchRow({ title, subtitle });
    settings.bind(key, row, "active", Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function syncSensitivity(settings, key, rows) {
    const update = () => {
        const on = settings.get_boolean(key);
        for (const r of rows) r.sensitive = on;
    };
    update();
    settings.connect(`changed::${key}`, update);
}

/**
 * Build an Adw.ActionRow that shows a chosen image file path and opens a
 * Gtk.FileChooserNative to pick a new one.
 *
 * @param {object} opts
 * @param {string}   opts.title
 * @param {string}   opts.subtitle
 * @param {string}   opts.settingsKey  - The extension settings key (stores a file URI)
 * @param {Gio.Settings} opts.settings
 * @param {Gtk.Window}   opts.window   - Parent window for the file chooser dialog
 */
function makeWallpaperRow({ title, subtitle, settingsKey, settings, window }) {
    const row = new Adw.ActionRow({ title, subtitle });

    // Label showing the current filename (or placeholder).
    const uriToLabel = (uri) => {
        if (!uri) return "Not set";
        try {
            return GLib.filename_from_uri(uri, null)[0].split("/").pop();
        } catch (_) {
            return uri.split("/").pop();
        }
    };

    const label = new Gtk.Label({
        label: uriToLabel(settings.get_string(settingsKey)),
        ellipsize: 3, // PANGO_ELLIPSIZE_END
        max_width_chars: 28,
        css_classes: ["dim-label"],
        valign: Gtk.Align.CENTER,
    });

    const button = new Gtk.Button({
        icon_name: "document-open-symbolic",
        valign: Gtk.Align.CENTER,
        css_classes: ["flat"],
        tooltip_text: "Choose image…",
    });

    const clearButton = new Gtk.Button({
        icon_name: "edit-clear-symbolic",
        valign: Gtk.Align.CENTER,
        css_classes: ["flat"],
        tooltip_text: "Clear (do not change wallpaper)",
    });

    row.add_suffix(label);
    row.add_suffix(button);
    row.add_suffix(clearButton);
    row.set_activatable_widget(button);

    button.connect("clicked", () => {
        const dialog = new Gtk.FileChooserNative({
            title: "Choose a wallpaper image",
            action: Gtk.FileChooserAction.OPEN,
            transient_for: window,
            modal: true,
            accept_label: "Select",
            cancel_label: "Cancel",
        });

        // Filter for common image types.
        const filter = new Gtk.FileFilter();
        filter.set_name("Images");
        ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"].forEach(
            (mt) => filter.add_mime_type(mt)
        );
        dialog.add_filter(filter);

        // Pre-select the currently stored file, if any.
        const current = settings.get_string(settingsKey);
        if (current) {
            try {
                dialog.set_file(Gio.File.new_for_uri(current));
            } catch (_) {}
        } else {
            // Default to ~/Pictures if it exists, else home dir.
            const pics = `${GLib.get_home_dir()}/Pictures`;
            const startDir = fileExists(pics) ? pics : GLib.get_home_dir();
            try {
                dialog.set_current_folder(Gio.File.new_for_path(startDir));
            } catch (_) {}
        }

        dialog.connect("response", (dlg, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = dlg.get_file();
                if (file) {
                    const uri = file.get_uri();
                    settings.set_string(settingsKey, uri);
                    label.set_label(uriToLabel(uri));
                }
            }
        });

        dialog.show();
    });

    clearButton.connect("clicked", () => {
        settings.set_string(settingsKey, "");
        label.set_label(uriToLabel(""));
    });

    // Keep label in sync if settings change externally.
    settings.connect(`changed::${settingsKey}`, () => {
        label.set_label(uriToLabel(settings.get_string(settingsKey)));
    });

    return row;
}

// ── Preferences window ────────────────────────────────────────────────────────

export default class Gtk3ThemeSwitcherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const gtkThemes     = getGtk3Themes();
        const iconThemes    = getIconThemes();
        const kvantumThemes = getKvantumThemes();

        window.set_default_size(640, 640);

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
            : `${kvantumThemes.length} Kvantum theme(s) detected. Note: running Qt apps must be restarted to pick up theme changes.`;

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

        // ── Wallpaper ─────────────────────────────────────────────────────
        const wpGroup = new Adw.PreferencesGroup({
            title: "Wallpaper",
            description:
                "Automatically switch the desktop wallpaper with the color scheme. " +
                "Disable this if your wallpaper already handles dark/light switching on its own.",
        });
        page.add(wpGroup);

        const manageWpRow = makeSwitchRow(settings, {
            title: "Switch wallpaper automatically",
            subtitle: "Enable to set a different wallpaper for each color scheme",
            key: "manage-wallpaper",
        });
        wpGroup.add(manageWpRow);

        const darkWpRow = makeWallpaperRow({
            title: "Dark wallpaper",
            subtitle: 'Applied when the system color scheme is "prefer-dark"',
            settingsKey: "wallpaper-dark-uri",
            settings,
            window,
        });
        wpGroup.add(darkWpRow);

        const lightWpRow = makeWallpaperRow({
            title: "Light wallpaper",
            subtitle: "Applied when the system color scheme is light",
            settingsKey: "wallpaper-light-uri",
            settings,
            window,
        });
        wpGroup.add(lightWpRow);

        syncSensitivity(settings, "manage-wallpaper", [darkWpRow, lightWpRow]);
    }
}

# GTK3 Theme Switcher

A GNOME Shell extension that automatically switches GTK3 application themes and icon themes based on the system's color scheme (light/dark mode). This extension enhances the user experience by ensuring GTK3 apps match the current GNOME theme, supporting custom themes like adw-gtk3 for a native GNOME 4x look.

## Features

- **Automatic Theme Switching**: Seamlessly switches GTK3 themes when the system color scheme changes (e.g., from light to dark mode).
- **Custom Theme Support**: Choose specific GTK3 themes for light and dark modes, including custom themes like adw-gtk3.
- **Icon Theme Management**: Optionally switch icon themes alongside GTK3 themes for a complete visual consistency.
- **User-Friendly Preferences**: Easy-to-use GUI for configuring themes via GNOME Extensions preferences.
- **GNOME Integration**: Monitors system settings and applies changes instantly without manual intervention.

## Installation

### From GNOME Extensions Website

1. Visit the [GNOME Extensions website](https://extensions.gnome.org/).
2. Search for "GTK3 Theme Switcher".
3. Click "Install" and follow the prompts.

### Manual Installation

1. Download the latest release from the [GitHub Releases](https://github.com/yourusername/gtk3-theme-switcher/releases) page.
2. Extract the archive to `~/.local/share/gnome-shell/extensions/gtk3-theme-switcher@local/`.
3. Restart GNOME Shell (press `Alt+F2`, type `r`, and press Enter) or log out and back in.
4. Enable the extension using GNOME Extensions or GNOME Tweaks.

### Dependencies

- GNOME Shell 45, 46, 47, 48, or 49.
- GTK3 themes installed on your system (e.g., Adwaita, adw-gtk3).
- Optional: Icon themes for full functionality.

## Usage

Once installed and enabled:

1. The extension will automatically apply the configured GTK3 theme based on your system's color scheme.
2. If icon theme switching is enabled, it will also update the icon theme accordingly.
3. Changes take effect immediately when you switch between light and dark modes in GNOME Settings.

### Configuring Preferences

1. Open GNOME Extensions or GNOME Tweaks.
2. Find "GTK3 Theme Switcher" and click the settings icon (gear).
3. **GTK3 Theme Section**:
   - Select a dark theme (default: Adwaita-dark).
   - Optionally select a light theme (leave blank for system default).
4. **Icon Theme Section**:
   - Toggle "Switch icon theme automatically" to enable icon theme switching.
   - Choose dark and light icon themes (leave blank to not change).

The extension scans common theme directories (`~/.themes`, `/usr/share/themes`, etc.) to populate the theme lists.

## Screenshots

*(Add screenshots here if available)*

## Contributing

Contributions are welcome! This extension is based on [gtk3-auto-dark](https://codeberg.org/swsnr/gnome-shell-extension-gtk3-auto-dark) by Sebastian Wiesner.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test thoroughly.
4. Submit a pull request.

### Development Setup

- Clone the repository.
- Ensure you have the GNOME Shell development environment set up.
- Use `glib-compile-schemas schemas/` to compile the schema.
- Test the extension with `gnome-extensions install` or manually.

## License

This extension is licensed under MPL 2.0 / GPL 2+. See the original [gtk3-auto-dark](https://codeberg.org/swsnr/gnome-shell-extension-gtk3-auto-dark) for more details.

## Support

If you encounter issues or have questions:

- Check the [Issues](https://github.com/yourusername/gtk3-theme-switcher/issues) page on GitHub.
- Ensure your GNOME Shell version is supported (45-49).
- Verify that your GTK3 themes are properly installed.

## Changelog

### Version 1.0
- Initial release.
- Automatic GTK3 and icon theme switching.
- Preferences UI for theme selection.
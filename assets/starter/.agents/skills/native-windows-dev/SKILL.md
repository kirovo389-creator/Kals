# Native Windows Development

Use this skill for local Windows development in Astra 0.3.0.

## Environment inspection

- Check Windows version, CPU architecture, available RAM and disk space before proposing a large installation or build.
- Use PowerShell for Windows-native commands and quote paths containing spaces.
- Detect installed Godot and Blender versions before downloading tools.
- Prefer official installers and portable releases. Explain size and system changes before installing engines or IDEs.
- Keep caches and temporary files under the current project or Astra cache directory.

## File and process discipline

- The Agent Server runs directly with the current Windows user's permissions. There is no container boundary.
- Work inside the project selected by the user when practical, but do not imply that other Windows paths are inaccessible.
- Never search for, display, copy or transmit secrets, browser cookies, SSH keys, API keys or credential files.
- Ask before destructive bulk operations, deleting user data, changing global system settings or terminating unrelated processes.
- Use bounded processes and explicit output paths. Record commands, exit codes and logs.
- Before claiming a build or render succeeded, run it and inspect resulting files or captured evidence.

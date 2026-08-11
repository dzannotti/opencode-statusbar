# opencode-statusbar

OpenCode TUI plugin that renders project status in the bottom prompt row (where the model/token info lives) — the same area a Claude Code statusline occupies.

```
🌿 main  📝 +42 ~17
```

The plugin registers into the `session_prompt_right` slot, so it plays nice with other plugins that render there (e.g. a token-metrics bar). No sidebar required.

## Install

Point `tui.json` at the plugin source. OpenCode (via Bun) compiles the `.tsx` at load time — no build step.

```jsonc
// ~/.config/opencode/tui.json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/path/to/opencode-statusbar/src/index.tsx"]
}
```

Requires a repo checkout with dependencies installed:

```bash
git clone https://github.com/dzannotti/opencode-statusbar
cd opencode-statusbar
bun install
```

Restart OpenCode. The status items appear on the right side of the bottom prompt row.

### As a package

The package exposes a `./tui` entrypoint, so once published to npm it can be loaded as a regular TUI plugin:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-statusbar"]
}
```

## Configuration

Create `~/.config/opencode/statusbar.json`:

```jsonc
{
  "items": [
    { "type": "git-branch", "format": "🌿 {branch}" },
    { "type": "git-diff", "format": "📝 +{added} ~{deleted}" },
    { "type": "custom", "command": "basename \"$(pwd)\"", "format": "📁 {output}" }
  ],
  "refreshInterval": 500,
  "periodicInterval": 3000
}
```

### Status items

| type        | description                                   | format placeholders  |
| ----------- | --------------------------------------------- | -------------------- |
| `git-branch`| Current git branch                            | `{branch}`           |
| `git-diff`  | Unstaged added/deleted lines                  | `{added}`, `{deleted}` |
| `custom`    | Output of an arbitrary shell command          | `{output}`           |

Every item supports `format` (template with `{key}` placeholders) and `maxLength` (truncation). Items that produce no output are hidden.

### Options

| option            | default | description                                   |
| ----------------- | ------- | --------------------------------------------- |
| `refreshInterval` | `500`   | Debounce interval in ms after OpenCode events |
| `periodicInterval`| `3000`  | Fallback refresh interval in ms (min `500`)   |

## Development

```bash
bun install
# edit src/index.tsx, point tui.json at it, restart OpenCode
```

## License

MIT

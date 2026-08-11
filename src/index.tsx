/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule, TuiSlotPlugin } from "@opencode-ai/plugin/tui"
import { For, createSignal } from "solid-js"
import { exec } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const execAsync = promisify(exec)

interface StatusItem {
  type: "git-branch" | "git-diff" | "custom"
  format?: string
  command?: string
  maxLength?: number
}

interface Config {
  items: StatusItem[]
  refreshInterval: number
  periodicInterval: number
}

const DEFAULT_CONFIG: Config = {
  items: [
    { type: "git-branch", format: "🌿 {branch}" },
    { type: "git-diff", format: "📝 +{added} ~{deleted}" },
  ],
  refreshInterval: 500,
  periodicInterval: 3000,
}

const CONFIG_PATHS = [join(homedir(), ".config", "opencode", "statusbar.json")]

function loadConfig(): Config {
  for (const path of CONFIG_PATHS) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<Config>
      return {
        items: parsed.items ?? DEFAULT_CONFIG.items,
        refreshInterval: parsed.refreshInterval ?? DEFAULT_CONFIG.refreshInterval,
        periodicInterval: Math.max(500, parsed.periodicInterval ?? DEFAULT_CONFIG.periodicInterval),
      }
    } catch {
      // Fall back to defaults when the config is unreadable.
    }
  }
  return DEFAULT_CONFIG
}

function truncate(value: string, maxLength?: number): string {
  if (maxLength === undefined || value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function formatItem(item: StatusItem, data: Record<string, string | number>): string {
  let format = item.format ?? ""
  for (const [key, value] of Object.entries(data)) format = format.replaceAll(`{${key}}`, String(value))
  return truncate(format, item.maxLength)
}

async function commandOutput(command: string, directory: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command, { cwd: directory, timeout: 5_000 })
    return stdout.trim()
  } catch {
    return ""
  }
}

async function collectItem(item: StatusItem, directory: string): Promise<string> {
  switch (item.type) {
    case "git-branch": {
      const branch = await commandOutput("git branch --show-current", directory)
      return branch ? formatItem(item, { branch }) : ""
    }
    case "git-diff": {
      const output = await commandOutput("git diff --numstat", directory)
      let added = 0
      let deleted = 0
      for (const line of output.split("\n").filter(Boolean)) {
        const [addedText, deletedText] = line.split("\t")
        added += Number.parseInt(addedText, 10) || 0
        deleted += Number.parseInt(deletedText, 10) || 0
      }
      return added || deleted ? formatItem(item, { added, deleted }) : ""
    }
    case "custom": {
      const output = item.command ? await commandOutput(item.command, directory) : ""
      return output ? formatItem(item, { output }) : ""
    }
  }
}

function createStatusbar(api: TuiPluginApi, config: Config): TuiSlotPlugin {
  const [values, setValues] = createSignal<string[]>([])
  let pending: ReturnType<typeof setTimeout> | undefined
  let refreshing = false

  const refresh = async () => {
    if (refreshing) return
    refreshing = true
    try {
      const directory = api.state.path.directory
      const results = await Promise.all(config.items.map((item) => collectItem(item, directory)))
      setValues(results.filter(Boolean))
    } finally {
      refreshing = false
    }
  }

  const scheduleRefresh = () => {
    if (pending) return
    pending = setTimeout(() => {
      pending = undefined
      void refresh()
    }, config.refreshInterval)
  }

  const unsubscribers = [
    api.event.on("message.part.updated", scheduleRefresh),
    api.event.on("todo.updated", scheduleRefresh),
    api.event.on("session.updated", scheduleRefresh),
    api.event.on("session.idle", scheduleRefresh),
    api.event.on("file.edited", scheduleRefresh),
    api.event.on("vcs.branch.updated", scheduleRefresh),
  ]
  const interval = setInterval(scheduleRefresh, config.periodicInterval)
  api.lifecycle.onDispose(() => {
    if (pending) clearTimeout(pending)
    clearInterval(interval)
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  })
  void refresh()

  return {
    order: 60,
    slots: {
      session_prompt_right(context) {
        return (
          <box flexDirection="row" gap={2}>
            <For each={values()}>
              {(value) => <text fg={context.theme.current.textMuted}>{value}</text>}
            </For>
          </box>
        )
      },
    },
  }
}

const tui: TuiPlugin = async (api) => {
  api.slots.register(createStatusbar(api, loadConfig()))
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-statusbar",
  tui,
}

export default plugin

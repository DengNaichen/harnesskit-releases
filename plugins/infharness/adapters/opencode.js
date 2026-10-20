// Rendered by the CLI; no token access, shell interpolation or provider calls.
import { spawn } from "node:child_process";
const executable = __INFHARNESS_EXECUTABLE__;
const args = __INFHARNESS_ARGUMENTS__;
const server = __INFHARNESS_MCP__;
const syncHome = __INFHARNESS_SYNC_HOME__;
const syncArgs = __INFHARNESS_SYNC_ARGUMENTS__;

function sync(directory, id) {
  return new Promise((resolve) => {
    const child = spawn(executable, syncArgs, {
      cwd: directory,
      env: syncHome ? { ...process.env, HOME: syncHome } : process.env,
      stdio: ["pipe", "ignore", "ignore"],
    });
    const timer = setTimeout(() => { child.kill(); resolve(); }, 65000);
    child.on("error", () => { clearTimeout(timer); resolve(); });
    child.on("close", () => { clearTimeout(timer); resolve(); });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: directory, session_id: id }));
  });
}
const memoryTools = new Set([
  "append_repository_observations",
  "get_repository_observation_promotion_snapshot",
  "prepare_repository_observation_promotions",
  "record_repository_observation_promotions",
]);

function hook(directory, sessionID, event, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: directory, stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("InfHarness hook timed out")); }, 5000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.stdin.on("error", () => {});
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > 1024 * 1024) { child.kill(); reject(new Error("InfHarness hook output exceeded limit")); }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw new Error("InfHarness hook failed");
        resolve(stdout.trim() ? JSON.parse(stdout).hookSpecificOutput ?? {} : {});
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify({ cwd: directory, session_id: sessionID, hook_event_name: event, ...extra }));
  });
}

export const InfHarness = async ({ client, directory }) => {
  // One registration snapshot per session; registration changes take effect in a new session.
  const gates = new Map();
  const rootSession = async (id) => {
    try {
      const result = await client.session.get({ path: { id } }, { signal: AbortSignal.timeout(1000) });
      return result.data?.id === id && !result.data.parentID;
    } catch { return false; }
  };
  const gate = (id) => {
    if (!gates.has(id)) gates.set(id, (async () => {
      if (!(await rootSession(id))) return "";
      void sync(directory, id);
      try { return (await hook(directory, id, "SessionStart", { source: "startup" })).additionalContext ?? ""; }
      catch { return ""; }
    })());
    return gates.get(id);
  };
  return {
    config: async (config) => {
      config.mcp ??= {};
      // Preserve an existing server, including disabled state and user overrides.
      config.mcp.infharness ??= server;
    },
    event: async ({ event }) => {
      if (event.type === "session.deleted") gates.delete(event.properties.info.id);
    },
    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return;
      const context = await gate(input.sessionID);
      if (context) output.system.push(context);
    },
    "tool.execute.before": async (input, output) => {
      const name = input.tool.startsWith("infharness_") ? input.tool.slice("infharness_".length) : "";
      if (!memoryTools.has(name)) return;
      const result = await hook(directory, input.sessionID, "PreToolUse", {
        tool_name: `mcp__infharness__${name}`, tool_input: output.args,
      });
      if (result.permissionDecision === "deny" || !result.updatedInput) throw new Error("InfHarness observation context is unavailable");
      // OpenCode's MCP transport retains the original args object.
      // Mutate it in place, including removals such as maintenance_root.
      for (const key of Object.keys(output.args)) delete output.args[key];
      for (const [key, value] of Object.entries(result.updatedInput)) {
        Object.defineProperty(output.args, key, { value, enumerable: true, writable: true, configurable: true });
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "bash" || !(await rootSession(input.sessionID))) return;
      await gate(input.sessionID);
      try {
        const result = await hook(directory, input.sessionID, "PostToolUse", { tool_name: "Bash" });
        if (result.additionalContext) output.output += `\n\n${result.additionalContext}`;
      } catch { /* Git feedback remains cooperative and fail-open. */ }
    },
  };
};

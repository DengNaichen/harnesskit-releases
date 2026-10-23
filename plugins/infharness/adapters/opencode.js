// Rendered by the CLI; no token access, shell interpolation or provider calls.
import { spawn } from "node:child_process";
const executable = __INFHARNESS_EXECUTABLE__;
const args = __INFHARNESS_ARGUMENTS__;
const server = __INFHARNESS_MCP__;
// Both native OAuth listeners support an explicit path; the broker admits this
// callback for the pre-registered public client without dynamic registration.
server.oauth.redirectUri = "http://127.0.0.1:19876/callback/opencode";
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

function lifecycle(directory, rootSession) {
  // One registration snapshot per session; registration changes take effect in a new session.
  const gates = new Map();
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
    gate,
    remove: (id) => gates.delete(id),
    clear: () => gates.clear(),
    before: async (tool, sessionID, input) => {
      const name = tool.startsWith("infharness_") ? tool.slice("infharness_".length) : "";
      if (!memoryTools.has(name)) return;
      const result = await hook(directory, sessionID, "PreToolUse", {
        tool_name: `mcp__infharness__${name}`, tool_input: input,
      });
      if (result.permissionDecision === "deny" || !result.updatedInput) throw new Error("InfHarness observation context is unavailable");
      // V1's MCP transport retains the original args object. Keep the same
      // identity in both APIs, including removals such as maintenance_root.
      for (const key of Object.keys(input)) delete input[key];
      for (const [key, value] of Object.entries(result.updatedInput)) {
        Object.defineProperty(input, key, { value, enumerable: true, writable: true, configurable: true });
      }
    },
    after: async (tool, sessionID, input) => {
      if (tool !== "bash" || !(await rootSession(sessionID))) return "";
      await gate(sessionID);
      try {
        const result = await hook(directory, sessionID, "PostToolUse", { tool_name: "Bash", tool_input: input });
        return result.additionalContext ?? "";
      } catch { return ""; /* Git feedback remains cooperative and fail-open. */ }
    },
  };
}

export const InfHarness = async ({ client, directory }) => {
  const rootSession = async (id) => {
    try {
      const result = await client.session.get({ path: { id } }, { signal: AbortSignal.timeout(1000) });
      return result.data?.id === id && !result.data.parentID;
    } catch { return false; }
  };
  const events = lifecycle(directory, rootSession);
  return {
    config: async (config) => {
      config.mcp ??= {};
      // Preserve an existing server, including disabled state and user overrides.
      config.mcp.infharness ??= server;
    },
    event: async ({ event }) => {
      if (event.type === "session.deleted") events.remove(event.properties.info.id);
    },
    dispose: () => events.clear(),
    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return;
      const context = await events.gate(input.sessionID);
      if (context) output.system.push(context);
    },
    "tool.execute.before": async (input, output) => {
      await events.before(input.tool, input.sessionID, output.args);
    },
    "tool.execute.after": async (input, output) => {
      const context = await events.after(input.tool, input.sessionID, input.args);
      if (context) output.output += `\n\n${context}`;
    },
  };
};

// Plain JavaScript implements the public definition shape without requiring an
// SDK package in the user's config directory. V1 calls server; V2 calls setup.
export default {
  id: "infharness",
  server: InfHarness,
  async setup(ctx) {
    const directory = ctx.location.directory;
    const rootSession = async (id) => {
      try {
        const session = await ctx.session.get({ sessionID: id }, { signal: AbortSignal.timeout(1000) });
        return session.id === id && !session.parentID && session.location.directory === directory;
      } catch { return false; }
    };
    const events = lifecycle(directory, rootSession);
    const feedback = new Map();
    await ctx.mcp.transform((editor) => {
      if (editor.get("infharness") !== undefined) return;
      editor.set("infharness", {
        type: "remote", url: server.url,
        oauth: { client_id: server.oauth.clientId, redirect_uri: server.oauth.redirectUri },
      });
    });
    await ctx.session.hook("context", async (event) => {
      const context = await events.gate(event.sessionID);
      if (context) event.system.push({ type: "text", text: context });
      for (const text of feedback.get(event.sessionID) ?? []) event.system.push({ type: "text", text });
      feedback.delete(event.sessionID);
    });
    await ctx.tool.hook("execute.before", async (event) => {
      await events.before(event.tool, event.sessionID, event.input);
    });
    await ctx.tool.hook("execute.after", async (event) => {
      if (event.status !== "completed" || event.tool !== "shell") return;
      const context = await events.after("bash", event.sessionID, event.input);
      if (!context) return;
      // Code Mode returns structured output rather than result.content. Deliver
      // feedback in the next model context without changing the tool's result.
      feedback.set(event.sessionID, [...(feedback.get(event.sessionID) ?? []), context]);
    });
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (event.type === "session.deleted") {
            events.remove(event.data.sessionID);
            feedback.delete(event.data.sessionID);
          }
        }
      } catch { /* Subscription ends when the host unloads this Plugin. */ }
    })();
    return () => { controller.abort(); events.clear(); feedback.clear(); };
  },
};

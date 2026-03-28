import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin } from "@paperai/shared";
import { executePluginRuntime, getPluginUiBridgeMount } from "./plugin-runtime.js";

const plugin: Plugin = {
  id: "plugin-1",
  companyId: "company-1",
  slug: "release-bot",
  name: "Release Bot",
  status: "active",
  manifest: {
    slug: "release-bot",
    name: "Release Bot",
    version: "1.0.0",
    capabilities: ["tool", "job", "webhook", "ui"],
    tools: [{ name: "summarize", description: "Summarize an issue" }],
  },
  config: {},
  createdAt: "2026-03-28T00:00:00.000Z",
  updatedAt: "2026-03-28T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("plugin runtime", () => {
  it("executes plugin tools over HTTP", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          accepted: true,
          worker: "http-plugin",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchImpl);

    const result = await executePluginRuntime(
      plugin,
      {
        baseUrl: "http://127.0.0.1:4444",
        headers: {
          "x-plugin-token": "secret",
        },
      },
      "tool",
      "summarize",
      { issueId: "issue-1" },
    );

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      transport: "http",
      accepted: true,
      worker: "http-plugin",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:4444/tools/summarize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-plugin-token": "secret",
        }),
      }),
    );
  });

  it("executes plugin tools over a local command transport", async () => {
    const script = [
      "let body='';",
      "process.stdin.on('data', chunk => body += chunk.toString());",
      "process.stdin.on('end', () => {",
      "  const parsed = JSON.parse(body);",
      "  process.stdout.write(JSON.stringify({ echoedKind: parsed.kind, echoedKey: parsed.key, echoedIssueId: parsed.payload.issueId }));",
      "});",
    ].join("");

    const result = await executePluginRuntime(
      plugin,
      {
        transport: "command",
        command: process.execPath,
        args: ["-e", script],
      },
      "tool",
      "summarize",
      { issueId: "issue-2" },
    );

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({
      transport: "command",
      echoedKind: "tool",
      echoedKey: "summarize",
      echoedIssueId: "issue-2",
    });
  });

  it("derives a UI bridge mount from plugin runtime config", () => {
    expect(
      getPluginUiBridgeMount(plugin, {
        baseUrl: "http://127.0.0.1:4444",
      }),
    ).toBe("http://127.0.0.1:4444/ui");

    expect(
      getPluginUiBridgeMount(plugin, {
        transport: "command",
        command: "node",
        uiBaseUrl: "http://127.0.0.1:5555/plugin-ui",
      }),
    ).toBe("http://127.0.0.1:5555/plugin-ui");
  });
});

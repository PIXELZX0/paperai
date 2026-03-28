const apiUrl = (process.env.PAPERAI_API_URL ?? "http://127.0.0.1:3001/api/v1").replace(/\/$/, "");
const token = process.env.PAPERAI_TOKEN;
const companyId = process.env.PAPERAI_COMPANY_ID;
const pluginId = process.env.PAPERAI_PLUGIN_ID;

if (!token || !companyId) {
  console.error("PAPERAI_TOKEN and PAPERAI_COMPANY_ID are required.");
  process.exit(1);
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function main() {
  const checks = await Promise.all([
    request(`/org-tree?companyId=${encodeURIComponent(companyId!)}`),
    request(`/costs/overview?companyId=${encodeURIComponent(companyId!)}`),
    request(`/costs/finance-events?companyId=${encodeURIComponent(companyId!)}`),
    request(`/costs/quota-windows?companyId=${encodeURIComponent(companyId!)}`),
    request(`/skills?companyId=${encodeURIComponent(companyId!)}`),
    request(`/secrets?companyId=${encodeURIComponent(companyId!)}`),
    request(`/execution-workspaces?companyId=${encodeURIComponent(companyId!)}`),
    request(`/companies/${encodeURIComponent(companyId!)}/join-requests`),
  ]);

  const results = {
    orgTree: checks[0],
    costs: checks[1],
    financeEvents: checks[2],
    quotaWindows: checks[3],
    skills: checks[4],
    secrets: checks[5],
    executionWorkspaces: checks[6],
    joinRequests: checks[7],
    plugin: pluginId
      ? {
          health: await request(`/plugins/${encodeURIComponent(pluginId)}/health`),
          ui: await request(`/plugins/${encodeURIComponent(pluginId)}/ui`),
        }
      : null,
  };

  const failed = Object.entries(results).flatMap(([key, value]) => {
    if (!value) {
      return [];
    }
    if ("status" in value) {
      return value.ok ? [] : [key];
    }
    return Object.entries(value)
      .filter(([, nested]) => !nested.ok)
      .map(([nestedKey]) => `${key}.${nestedKey}`);
  });

  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        apiUrl,
        companyId,
        failed,
        results,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

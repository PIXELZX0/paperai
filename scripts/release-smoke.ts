const baseUrl = (process.env.PAPERAI_API_URL ?? "http://127.0.0.1:3001/api/v1").replace(/\/$/, "");
const token = process.env.PAPERAI_TOKEN ?? null;
const companyId = process.env.PAPERAI_COMPANY_ID ?? null;

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }

  return await response.json();
}

async function main() {
  const health = await fetch(baseUrl.replace(/\/api\/v1$/, "/health"));
  if (!health.ok) {
    throw new Error(`/health failed with ${health.status}`);
  }

  const challenge = await request("/auth/cli/challenges", {
    method: "POST",
    body: JSON.stringify({ name: "release-smoke" }),
  });

  const polled = await request(
    `/auth/cli/challenges/${encodeURIComponent(String(challenge.id))}?challengeToken=${encodeURIComponent(String(challenge.challengeToken))}`,
  );

  let extended: Record<string, unknown> | null = null;
  if (token && companyId) {
    extended = {
      orgTree: await request(`/org-tree?companyId=${encodeURIComponent(companyId)}`),
      costOverview: await request(`/costs/overview?companyId=${encodeURIComponent(companyId)}`),
      financeEvents: await request(`/costs/finance-events?companyId=${encodeURIComponent(companyId)}`),
      quotaWindows: await request(`/costs/quota-windows?companyId=${encodeURIComponent(companyId)}`),
      skills: await request(`/skills?companyId=${encodeURIComponent(companyId)}`),
      plugins: await request(`/plugins?companyId=${encodeURIComponent(companyId)}`),
      executionWorkspaces: await request(`/execution-workspaces?companyId=${encodeURIComponent(companyId)}`),
      joinRequests: await request(`/companies/${encodeURIComponent(companyId)}/join-requests`),
    };
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        health: await health.json(),
        cliChallengeId: challenge.id,
        approved: polled.approved,
        extended,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

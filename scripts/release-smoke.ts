const baseUrl = (process.env.PAPERAI_API_URL ?? "http://127.0.0.1:3001/api/v1").replace(/\/$/, "");

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        health: await health.json(),
        cliChallengeId: challenge.id,
        approved: polled.approved,
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

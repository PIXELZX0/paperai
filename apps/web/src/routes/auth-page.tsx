import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, saveSession } from "../lib/api.js";

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(() => searchParams.get("invite") ?? searchParams.get("inviteToken") ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("invite") ?? searchParams.get("inviteToken") ?? "";
    if (token) {
      setInviteToken(token);
      setMode("register");
    }
  }, [searchParams]);

  async function submit() {
    setError(null);
    const result =
      mode === "login"
        ? await api.login(email, password)
        : await api.register(name, email, password, inviteToken);
    saveSession({ token: result.token, user: result.user, selectedCompanyId: null });
    navigate("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-12">
      <div className="grid w-full gap-10 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">PaperAI</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight text-white">
            Run a zero-human company with one shared control plane.
          </h1>
          <p className="max-w-xl text-lg text-zinc-300">
            Multi-user board controls, task orchestration, budgets, approvals, live heartbeats, and mixed local/API agents.
          </p>
          <div className="grid gap-3 text-sm text-zinc-400">
            <span>Company-wide AI orchestration</span>
            <span>Approval-gated governance</span>
            <span>Markdown-native company import/export</span>
          </div>
        </section>
        <section className="rounded-[1.75rem] border border-white/10 bg-zinc-950/60 p-6">
          <div className="mb-6 flex rounded-full bg-white/5 p-1 text-sm">
            {(["login", "register"] as const).map((candidate) => (
              <button
                key={candidate}
                className={`flex-1 rounded-full px-3 py-2 ${mode === candidate ? "bg-white text-zinc-950" : "text-zinc-300"}`}
                onClick={() => setMode(candidate)}
              >
                {candidate}
              </button>
            ))}
          </div>
          <div className="grid gap-4">
            {mode === "register" ? (
              <>
                <label className="grid gap-1 text-sm text-zinc-300">
                  <span>Name</span>
                  <input className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm text-zinc-300">
                  <span>Invite token (optional)</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2"
                    value={inviteToken}
                    placeholder="Paste an invite token to join a company"
                    onChange={(event) => setInviteToken(event.target.value)}
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-1 text-sm text-zinc-300">
              <span>Email</span>
              <input className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              <span>Password</span>
              <input className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 font-medium text-zinc-950"
              onClick={() => {
                void submit().catch((err) => setError(err instanceof Error ? err.message : "Request failed"));
              }}
            >
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

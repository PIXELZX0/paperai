import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, loadSession, saveSession } from "../lib/api.js";

const STAGES = [
  {
    id: "01",
    title: "Authenticate once",
    description:
      "Use your operator account or accept an invite without changing the backend auth flow.",
  },
  {
    id: "02",
    title: "Land in the shell",
    description:
      "Open the authenticated control plane at /app and keep all company operations in one place.",
  },
  {
    id: "03",
    title: "Create or join a company",
    description:
      "Provision the workspace from the operator shell using the same existing PaperAI capabilities.",
  },
];

const PREVIEW_ITEMS = [
  "Command palette navigation for every operator section.",
  "Company, cost, workspace, issue, plugin, and secret controls stay intact.",
  "Invite-aware signup keeps the setup surface unauthenticated.",
];

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(
    () => searchParams.get("invite") ?? searchParams.get("inviteToken") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session.token) {
      navigate("/app", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const token =
      searchParams.get("invite") ?? searchParams.get("inviteToken") ?? "";
    if (token) {
      setInviteToken(token);
      setMode("register");
    }
  }, [searchParams]);

  const stageLabel = useMemo(() => {
    if (mode === "login") {
      return "Return to your operator shell";
    }
    if (inviteToken.trim()) {
      return "Create your account and accept the pending invite";
    }
    return "Create your account, then set up the first company in /app";
  }, [inviteToken, mode]);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(name, email, password, inviteToken);
      saveSession({
        token: result.token,
        user: result.user,
        selectedCompanyId: null,
      });
      navigate("/app");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="paper-grid relative isolate overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="paper-panel flex flex-col justify-between rounded-[2.4rem] border px-6 py-7 sm:px-8 sm:py-8">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="paper-shell-label rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1 text-[0.7rem] font-medium">
                PaperAI · operator onboarding
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-zinc-400">
                v0.0.13 web reconstruction
              </span>
            </div>

            <div className="max-w-3xl space-y-5">
              <p className="paper-shell-label text-[0.7rem] font-medium">
                Unauthenticated setup surface
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Run a zero-human company with one shared control plane.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-zinc-300">
                The browser now opens like an operator assistant: authenticate
                here, understand the flow, then drop straight into the
                authenticated shell at{" "}
                <span className="text-cyan-200">/app</span>
                without changing the underlying API behavior.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {STAGES.map((stage) => (
                <article
                  key={stage.id}
                  className="rounded-[1.7rem] border border-white/10 bg-black/20 p-4"
                >
                  <div className="text-xs font-medium uppercase tracking-[0.26em] text-cyan-300/85">
                    {stage.id}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    {stage.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {stage.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] border border-white/10 bg-[rgba(5,10,18,0.85)] p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="paper-shell-label text-[0.65rem] font-medium">
                      Shell preview
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Paperclip-like operator shell
                    </h2>
                  </div>
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    Ctrl/Cmd + K
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-[1.4rem] border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
                    &gt; Jump to Overview, Workspaces, Issue Ops, Plugins,
                    Secrets…
                  </div>
                  {PREVIEW_ITEMS.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
                <p className="paper-shell-label text-[0.65rem] font-medium">
                  Why this surface exists
                </p>
                <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-300">
                  <p>
                    This page stays public by design. Authentication,
                    registration, and invite intake happen here.
                  </p>
                  <p>
                    Company creation and deeper operations still happen inside
                    the authenticated shell so the existing operator route and
                    backend contracts remain untouched.
                  </p>
                  <div className="rounded-[1.4rem] border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-emerald-100">
                    {stageLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Multi-user operator console
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Invite-aware registration
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Existing API behavior preserved
            </span>
          </div>
        </section>

        <section className="paper-panel rounded-[2.4rem] border px-6 py-7 sm:px-8 sm:py-8">
          <div className="flex h-full flex-col justify-between gap-7">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="paper-shell-label text-[0.7rem] font-medium">
                    Authentication
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">
                    {mode === "login"
                      ? "Welcome back"
                      : inviteToken.trim()
                        ? "Join the invited company"
                        : "Create your operator account"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-400">
                  Route contract: /
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-1.5">
                {(["login", "register"] as const).map((candidate) => {
                  const active = mode === candidate;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      className={`rounded-[1rem] px-4 py-3 text-sm font-medium transition ${
                        active
                          ? "paper-accent-button"
                          : "text-zinc-300 hover:bg-white/5"
                      }`}
                      onClick={() => setMode(candidate)}
                    >
                      {candidate === "login" ? "Sign in" : "Register"}
                    </button>
                  );
                })}
              </div>

              {inviteToken.trim() ? (
                <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 px-4 py-4 text-sm text-cyan-50">
                  Invite detected. Registration will keep the token and take you
                  directly into the authenticated shell.
                </div>
              ) : null}

              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit().catch((err) =>
                    setError(
                      err instanceof Error ? err.message : "Request failed",
                    ),
                  );
                }}
              >
                {mode === "register" ? (
                  <>
                    <label
                      htmlFor="auth-name"
                      className="grid gap-1.5 text-sm text-zinc-300"
                    >
                      <span className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-zinc-500">
                        Name
                      </span>
                      <input
                        id="auth-name"
                        className="paper-input rounded-[1.25rem] px-3.5 py-3"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </label>
                    <label
                      htmlFor="auth-invite"
                      className="grid gap-1.5 text-sm text-zinc-300"
                    >
                      <span className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-zinc-500">
                        Invite token (optional)
                      </span>
                      <input
                        id="auth-invite"
                        className="paper-input rounded-[1.25rem] px-3.5 py-3"
                        value={inviteToken}
                        placeholder="Paste an invite token to join a company"
                        onChange={(event) => setInviteToken(event.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                <label
                  htmlFor="auth-email"
                  className="grid gap-1.5 text-sm text-zinc-300"
                >
                  <span className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Email
                  </span>
                  <input
                    id="auth-email"
                    className="paper-input rounded-[1.25rem] px-3.5 py-3"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label
                  htmlFor="auth-password"
                  className="grid gap-1.5 text-sm text-zinc-300"
                >
                  <span className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Password
                  </span>
                  <input
                    id="auth-password"
                    className="paper-input rounded-[1.25rem] px-3.5 py-3"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>

                {error ? (
                  <p className="rounded-[1.2rem] border border-rose-300/15 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="paper-accent-button rounded-[1.35rem] px-4 py-3.5 text-sm font-semibold tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy}
                >
                  {busy
                    ? "Working..."
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </button>
              </form>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5 text-sm text-zinc-300">
              <p className="paper-shell-label text-[0.65rem] font-medium">
                What happens after auth
              </p>
              <div className="mt-4 space-y-3 leading-6 text-zinc-400">
                <p>
                  • Existing login/register API calls create the session and
                  keep route behavior unchanged.
                </p>
                <p>
                  • The authenticated shell stays at /app/:section? and
                  centralizes dashboard state for this release.
                </p>
                <p>
                  • Browser onboarding does not simulate CLI provisioning; it
                  hands off to the real operator console.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

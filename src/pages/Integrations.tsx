import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Github } from "lucide-react";
import { useWallet } from "../context";
import {
  accountRequest,
  signInAccount,
  type GithubConnection,
} from "../account-api";
import { studioSession, studioSessionKey, StudioApiError } from "../studio-api";
import "./integrations.css";

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

export function Integrations() {
  const wallet = useWallet();
  return <WalletIntegrations key={wallet.address ?? "visitor"} />;
}

function WalletIntegrations() {
  const wallet = useWallet();
  const [params, setParams] = useSearchParams();
  const [token, setToken] = useState(() =>
    wallet.address ? studioSession(wallet.address) : "",
  );
  const [github, setGithub] = useState<GithubConnection | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function fail(error: unknown) {
    if (!alive.current) return;
    setError(message(error));
    if (error instanceof StudioApiError && error.status === 401) {
      setToken("");
      if (wallet.address)
        sessionStorage.removeItem(studioSessionKey(wallet.address));
    }
  }

  async function task(label: string, fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (error) {
      fail(error);
    } finally {
      lock.current = false;
      if (alive.current) setBusy("");
    }
  }

  useEffect(() => {
    if (!token) return;
    void task("Loading integrations", async () => {
      const result = params.get("github");
      let connectionError: unknown;
      if (result === "callback") {
        const state = params.get("state"),
          code = params.get("code");
        setParams({}, { replace: true });
        try {
          await accountRequest("/integrations/github/complete", token, {
            state,
            code,
          });
        } catch (error) {
          connectionError = error;
        }
      }
      const integrations = await accountRequest<{ github: GithubConnection }>(
        "/integrations",
        token,
      );
      if (!alive.current) return;
      setGithub(integrations.github);
      if (connectionError) setError(message(connectionError));
      if (result && !connectionError) {
        setNotice(
          result === "callback"
            ? "GitHub connected to your wallet."
            : result === "cancelled"
              ? "GitHub connection cancelled."
              : "GitHub could not connect. Try again.",
        );
        setParams({}, { replace: true });
      }
    });
  }, [token]);

  const signIn = () =>
    task("Signing in", async () => {
      if (!wallet.address) {
        wallet.setModalOpen(true);
        return;
      }
      const session = await signInAccount(
        wallet.address,
        wallet.signMessage,
        () => alive.current,
      );
      if (alive.current) setToken(session.token);
    });

  return (
    <main className="integrations-page">
      <header className="integrations-heading">
        <h1>Integrations</h1>
        <p>
          Connect the services you use. Your integrations are saved to your
          wallet.
        </p>
      </header>
      {!token ? (
        <section className="integrations-signin">
          <h2>Connect your wallet</h2>
          <p>Sign in with your wallet to manage your saved integrations.</p>
          <button
            className="integrations-primary"
            disabled={Boolean(busy)}
            onClick={() => void signIn()}
          >
            {busy ||
              (wallet.address ? "Sign in with wallet" : "Connect wallet")}
          </button>
          {error && <p role="alert">{error}</p>}
        </section>
      ) : (
        <section
          className="integrations-content"
          aria-label="Wallet integrations"
        >
          <div className="integrations-wallet">
            <span>Connected wallet</span>
            <code title={wallet.address ?? ""}>
              {wallet.address?.slice(0, 7)}…{wallet.address?.slice(-7)}
            </code>
          </div>
          {error && (
            <div className="integrations-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="integrations-notice" role="status">
              {notice}
            </div>
          )}
          <article className="integration-card">
            <Github size={28} />
            <div>
              <h2>GitHub</h2>
              <p>
                {github?.connected
                  ? `Connected as ${github.login}`
                  : "Create a new repository from any Atlantis project."}
              </p>
              <small>
                Your connection stays linked to this wallet. Choose a public or
                private repository when exporting.
              </small>
            </div>
            {github?.connected ? (
              <button
                disabled={Boolean(busy)}
                onClick={() =>
                  void task("Disconnecting GitHub", async () => {
                    const result = await accountRequest<{ revoked: boolean }>(
                      "/integrations/github",
                      token,
                      undefined,
                      "DELETE",
                    );
                    if (!alive.current) return;
                    setGithub((old) =>
                      old ? { ...old, connected: false, login: null } : old,
                    );
                    setNotice(
                      result.revoked
                        ? "GitHub disconnected."
                        : "Disconnected from AQUA. You can also revoke AQUA in your GitHub account settings.",
                    );
                  })
                }
              >
                Disconnect
              </button>
            ) : (
              <button
                className="integrations-primary"
                disabled={Boolean(busy) || !github?.enabled}
                onClick={() =>
                  void task("Connecting GitHub", async () => {
                    const { url } = await accountRequest<{ url: string }>(
                      "/integrations/github/connect",
                      token,
                      {},
                    );
                    if (alive.current) location.assign(url);
                  })
                }
              >
                {busy || "Connect GitHub"}
              </button>
            )}
          </article>
          {github && !github.enabled && (
            <p className="integrations-help">
              GitHub connection is not enabled yet. ZIP exports are available in
              Studio.
            </p>
          )}
          <p className="integrations-help">
            GitHub asks for repository and workflow access so AQUA can create
            your repository and include the Pages deployment workflow.
            Connection credentials stay on AQUA’s server and are never sent to
            Atlantis’s AI.
          </p>
          <Link className="integrations-back" to="/studio">
            Return to Atlantis Studio
            <ArrowUpRight size={14} />
          </Link>
        </section>
      )}
    </main>
  );
}

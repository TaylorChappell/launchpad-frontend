import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Check, Github, Upload, X } from "lucide-react";
import { useWallet } from "../context";
import {
  accountRequest,
  signInAccount,
  type AquaProfile,
  type GithubConnection,
} from "../account-api";
import { studioSession, studioSessionKey, StudioApiError } from "../studio-api";
import "./account.css";

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export function AccountSettings() {
  const wallet = useWallet();
  return <Settings key={wallet.address ?? "visitor"} />;
}
function Settings() {
  const wallet = useWallet(),
    { section } = useParams(),
    [params, setParams] = useSearchParams();
  const integrations = section === "integrations";
  const [token, setToken] = useState(() =>
    wallet.address ? studioSession(wallet.address) : "",
  );
  const [profile, setProfile] = useState<AquaProfile | null>(null),
    [saved, setSaved] = useState("");
  const [github, setGithub] = useState<GithubConnection | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const alive = useRef(true),
    lock = useRef(false),
    upload = useRef<HTMLInputElement>(null);
  const dirty = Boolean(profile && saved !== JSON.stringify(profile));
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
    } catch (e) {
      fail(e);
    } finally {
      lock.current = false;
      if (alive.current) setBusy("");
    }
  }
  useEffect(() => {
    if (!token) return;
    void task("Loading account", async () => {
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
      const [p, i] = await Promise.all([
        accountRequest<AquaProfile>("/me", token),
        accountRequest<{ github: GithubConnection }>("/integrations", token),
      ]);
      if (!alive.current) return;
      setProfile(p);
      setSaved(JSON.stringify(p));
      setGithub(i.github);
      if (connectionError) setError(message(connectionError));
      if (result && !connectionError) {
        setNotice(
          result === "callback"
            ? "GitHub connected to your wallet account."
            : result === "cancelled"
              ? "GitHub connection cancelled."
              : "GitHub could not connect. Try again.",
        );
        setParams({}, { replace: true });
      }
    });
  }, [token]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (!profile) return;
    await task("Saving profile", async () => {
      const value = await accountRequest<AquaProfile>(
        "/profile",
        token,
        profile,
      );
      if (!alive.current) return;
      setProfile(value);
      setSaved(JSON.stringify(value));
      setNotice("Profile saved.");
      window.dispatchEvent(new Event("aqua:profile-updated"));
    });
  }
  async function addLogo(file: File | undefined) {
    if (!file || !profile) return;
    await task("Preparing logo", async () => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5000000
      )
        throw new Error("Choose a PNG, JPG or WebP image under 5 MB.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const logo = canvas.toDataURL("image/webp", 0.88);
      if (alive.current) setProfile((old) => (old ? { ...old, logo } : old));
    });
  }
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
    <main className="account-page">
      <header className="account-heading">
        <div>
          <h1>Account settings</h1>
          <p>Your identity and connections on AQUA.</p>
        </div>
        {wallet.address && (
          <Link to={`/profile/${wallet.address}`}>
            View profile
            <ArrowUpRight size={15} />
          </Link>
        )}
      </header>
      {!token ? (
        <section className="account-signin">
          <h2>Your wallet is your account.</h2>
          <p>
            Sign in to edit your profile and manage integrations. Your profile
            and connected accounts stay linked to this wallet.
          </p>
          <button
            className="account-primary"
            disabled={Boolean(busy)}
            onClick={() => void signIn()}
          >
            {busy || (wallet.address ? "Sign in to AQUA" : "Connect wallet")}
          </button>
          {error && <p role="alert">{error}</p>}
        </section>
      ) : (
        <div className="account-layout">
          <nav aria-label="Account settings">
            <Link
              className={!integrations ? "selected" : ""}
              to="/settings/profile"
            >
              Profile
            </Link>
            <Link
              className={integrations ? "selected" : ""}
              to="/settings/integrations"
            >
              Integrations
            </Link>
            <div className="account-wallet">
              <span>Wallet account</span>
              <code>
                {wallet.address?.slice(0, 7)}…{wallet.address?.slice(-7)}
              </code>
            </div>
          </nav>
          <section className="account-content">
            {error && (
              <div className="account-error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="account-notice" role="status">
                {notice}
              </div>
            )}
            {integrations ? (
              <>
                <header>
                  <h2>Integrations</h2>
                  <p>Connect the services you use to build and publish.</p>
                </header>
                <article className="account-integration">
                  <Github size={28} />
                  <div>
                    <h3>GitHub</h3>
                    <p>
                      {github?.connected
                        ? `Connected as ${github.login}`
                        : "Create a new repository from any Atlantis project."}
                    </p>
                    <small>
                      Your connection is saved to this wallet. Export asks
                      before creating a public or private repository.
                    </small>
                  </div>
                  {github?.connected ? (
                    <button
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void task("Disconnecting GitHub", async () => {
                          const result = await accountRequest<{
                            revoked: boolean;
                          }>(
                            "/integrations/github",
                            token,
                            undefined,
                            "DELETE",
                          );
                          if (!alive.current) return;
                          setGithub((old) =>
                            old
                              ? { ...old, connected: false, login: null }
                              : old,
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
                      className="account-primary"
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
                  <p className="account-help">
                    GitHub connection is not enabled yet. ZIP exports are
                    available in Studio.
                  </p>
                )}
                <p className="account-help">
                  GitHub asks for repository and workflow access so AQUA can
                  create your repository and include the Pages deployment
                  workflow. Connection credentials stay on AQUA’s server and are
                  never sent to Atlantis’s AI.
                </p>
                <Link className="account-back" to="/studio">
                  Return to Atlantis Studio
                  <ArrowUpRight size={14} />
                </Link>
              </>
            ) : (
              <>
                <header>
                  <h2>Profile</h2>
                  <p>
                    Your logo, username and description appear on your public
                    AQUA profile.
                  </p>
                </header>
                {profile ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save();
                    }}
                  >
                    <div className="account-logo-row">
                      <div className="account-avatar">
                        {profile.logo ? (
                          <img src={profile.logo} alt="Your profile logo" />
                        ) : (
                          <span>
                            {(profile.username || "A")
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => upload.current?.click()}
                        >
                          <Upload size={15} />
                          Upload logo
                        </button>
                        <small>PNG, JPG or WebP. Up to 5 MB.</small>
                      </div>
                      {profile.logo && (
                        <button
                          type="button"
                          className="account-remove-logo"
                          aria-label="Remove logo"
                          disabled={Boolean(busy)}
                          onClick={() => setProfile({ ...profile, logo: "" })}
                        >
                          <X size={16} />
                        </button>
                      )}
                      <input
                        ref={upload}
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          void addLogo(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <label>
                      Username
                      <input
                        value={profile.username}
                        minLength={3}
                        maxLength={24}
                        pattern="[A-Za-z0-9_]+"
                        required
                        autoComplete="off"
                        placeholder="Your name on AQUA"
                        disabled={Boolean(busy)}
                        onChange={(e) =>
                          setProfile({ ...profile, username: e.target.value })
                        }
                      />
                      <small>
                        3 to 24 letters, numbers or underscores. Each username
                        is unique.
                      </small>
                    </label>
                    <label>
                      Description
                      <textarea
                        value={profile.description}
                        maxLength={500}
                        rows={5}
                        placeholder="Tell people a bit about yourself."
                        disabled={Boolean(busy)}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            description: e.target.value,
                          })
                        }
                      />
                      <small>{profile.description.length}/500</small>
                    </label>
                    <footer>
                      <span>
                        {dirty ? "Unsaved changes" : "All changes saved"}
                      </span>
                      <button
                        className="account-primary"
                        disabled={Boolean(busy) || !dirty}
                      >
                        <Check size={15} />
                        {busy || "Save profile"}
                      </button>
                    </footer>
                  </form>
                ) : (
                  <p>Loading your profile…</p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
export function Profile() {
  const { wallet: address } = useParams(),
    wallet = useWallet(),
    [profile, setProfile] = useState<AquaProfile | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setProfile(null);
    setError("");
    if (address)
      void accountRequest<AquaProfile>(
        `/profiles/${encodeURIComponent(address)}`,
      )
        .then((value) => {
          if (active) setProfile(value);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    return () => {
      active = false;
    };
  }, [address]);
  return (
    <main className="account-page public-profile">
      <Link className="account-back" to="/">
        Explore AQUA
      </Link>
      {error ? (
        <p role="alert">{error}</p>
      ) : profile ? (
        <article>
          <div className="account-avatar">
            {profile.logo ? (
              <img
                src={profile.logo}
                alt={`${profile.username || "AQUA"} profile logo`}
              />
            ) : (
              <span>{(profile.username || "A")[0].toUpperCase()}</span>
            )}
          </div>
          <h1>{profile.username ? `@${profile.username}` : "AQUA member"}</h1>
          {profile.description && <p>{profile.description}</p>}
          <div className="public-profile-wallet">
            <span>Wallet</span>
            <code>{profile.wallet}</code>
          </div>
          {wallet.address === address && (
            <Link className="account-primary" to="/settings/profile">
              Edit profile
            </Link>
          )}
        </article>
      ) : (
        <p>Loading profile…</p>
      )}
    </main>
  );
}

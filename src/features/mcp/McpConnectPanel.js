import React, { useCallback, useMemo, useState } from "react";

const DEFAULT_MCP_URL = "https://tuxcashier.vercel.app/api/mcp";
const DEFAULT_SCOPES = [
  "read:orders",
  "read:inventory",
  "read:reports",
  "write:inventory",
  "write:orders",
  "write:expenses",
  "write:prices",
  "write:shift",
];
const TOKEN_WARNING =
  "Anyone with this link can access the allowed TUC tools. Keep it private.";

function CopyButton({ value, children, btnBorder }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt("Copy this value:", value || "");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: `1px solid ${btnBorder}`,
        cursor: value ? "pointer" : "not-allowed",
        fontWeight: 700,
      }}
    >
      {copied ? "Copied" : children}
    </button>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default function McpConnectPanel({
  dark,
  cardBorder,
  btnBorder,
  softBg,
  adminUnlocked,
  activeAdmin,
  ensureAdminUnlocked,
}) {
  const [adminPasscode, setAdminPasscode] = useState("");
  const [tokens, setTokens] = useState([]);
  const [createdToken, setCreatedToken] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentAdmin = useMemo(
    () =>
      activeAdmin || {
        adminId: "admin_1",
        adminName: "Admin 1",
        adminNumber: 1,
      },
    [activeAdmin]
  );
  const mcpUrl = DEFAULT_MCP_URL;
  const connectorUrl = useMemo(() => {
    if (!createdToken?.token) return "";
    return `${mcpUrl}?token=${encodeURIComponent(createdToken.token)}`;
  }, [createdToken, mcpUrl]);
  const latestToken =
    tokens.find((token) => token.active && !token.revoked_at) ||
    createdToken?.token_metadata ||
    tokens[0] ||
    null;

  const postJson = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.error || `Request failed with ${res.status}`);
    }
    return json;
  };

  const requireAdminPasscode = useCallback(() => {
    if (adminPasscode) return adminPasscode;
    const entered = window.prompt(`Enter ${currentAdmin.adminName} passcode:`, "");
    if (!entered) throw new Error(`${currentAdmin.adminName} passcode is required.`);
    setAdminPasscode(entered);
    return entered;
  }, [adminPasscode, currentAdmin.adminName]);

  const adminPayload = useCallback(
    (passcodeOverride) => ({
      admin_id: currentAdmin.adminId,
      admin_passcode: passcodeOverride || requireAdminPasscode(),
    }),
    [currentAdmin.adminId, requireAdminPasscode]
  );

  const ensureIdentity = async () => {
    if (adminUnlocked && activeAdmin) return activeAdmin;
    if (!ensureAdminUnlocked) return currentAdmin;
    const identity = await ensureAdminUnlocked();
    if (!identity) throw new Error("Admin unlock is required.");
    return identity;
  };

  const loadTokens = useCallback(
    async (passcodeOverride, adminOverride) => {
      const adminForRequest = adminOverride || currentAdmin;
      const passcode = passcodeOverride || requireAdminPasscode();
      setLoading(true);
      setError("");
      try {
        const data = await postJson("/api/mcp/token/list", {
          admin_id: adminForRequest.adminId,
          admin_passcode: passcode,
        });
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        setStatus("Connection status refreshed.");
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    },
    [currentAdmin, requireAdminPasscode]
  );

  const generateToken = async () => {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const identity = await ensureIdentity();
      const passcode = requireAdminPasscode();
      const data = await postJson("/api/mcp/token/create", {
        admin_id: identity.adminId || currentAdmin.adminId,
        admin_passcode: passcode,
        name: `${identity.adminName || currentAdmin.adminName} ChatGPT Connector`,
        scopes: DEFAULT_SCOPES,
      });
      setCreatedToken(data);
      setStatus("ChatGPT MCP URL created. Copy it now; the token will not be shown again.");
      await loadTokens(passcode, identity);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const revokeToken = async (tokenId) => {
    if (!window.confirm(`Revoke ChatGPT access for ${currentAdmin.adminName}?`)) return;
    setLoading(true);
    setError("");
    try {
      const passcode = requireAdminPasscode();
      await postJson("/api/mcp/token/revoke", {
        ...adminPayload(passcode),
        token_id: tokenId,
      });
      setCreatedToken(null);
      setStatus("ChatGPT access revoked.");
      await loadTokens(passcode);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const textColor = dark ? "#eee" : "#111";
  const muted = dark ? "#bbb" : "#555";
  const inputStyle = {
    padding: 8,
    borderRadius: 6,
    border: `1px solid ${btnBorder}`,
    background: dark ? "#1f1f1f" : "#fff",
    color: textColor,
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 8,
          padding: 14,
          background: softBg,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Connect to ChatGPT</h2>
        <p style={{ margin: "0 0 12px", color: muted }}>
          Create a private MCP connection for the currently unlocked admin. MCP tool calls will use this admin identity automatically.
        </p>

        <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
          <div>
            <b>Connection status:</b>{" "}
            {latestToken && latestToken.active && !latestToken.revoked_at ? "Active" : "Not connected"}
          </div>
          <div>
            <b>Connected admin:</b> {currentAdmin.adminName} ({currentAdmin.adminId})
          </div>
          <div>
            <b>Token created:</b> {formatDate(latestToken?.created_at)}
          </div>
          <div>
            <b>Last used:</b> {formatDate(latestToken?.last_used_at)}
          </div>

          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            MCP Server URL
            <input readOnly value={mcpUrl} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            {currentAdmin.adminName} passcode
            <input
              type="password"
              value={adminPasscode}
              onChange={(e) => setAdminPasscode(e.target.value)}
              placeholder="Admin passcode"
              style={inputStyle}
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={generateToken}
              disabled={loading}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "none",
                background: loading ? "#9e9e9e" : "#2e7d32",
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              Connect this admin to ChatGPT
            </button>
            <CopyButton value={connectorUrl} btnBorder={btnBorder}>
              Copy ChatGPT MCP URL
            </CopyButton>
            <button
              type="button"
              onClick={() => loadTokens()}
              disabled={loading}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${btnBorder}`,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Refresh Status
            </button>
            {latestToken?.active && !latestToken.revoked_at && (
              <button
                type="button"
                onClick={() => revokeToken(latestToken.id)}
                disabled={loading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "#c62828",
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                Revoke this admin's ChatGPT access
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, color: dark ? "#ffecb3" : "#8a5a00", fontWeight: 800 }}>
          {TOKEN_WARNING}
        </div>
        {status && (
          <div style={{ marginTop: 12, color: dark ? "#c8e6c9" : "#1b5e20", fontWeight: 700 }}>
            {status}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12, color: "#c62828", fontWeight: 700 }}>
            {error}
          </div>
        )}
      </section>

      {createdToken?.token && (
        <section
          style={{
            border: `1px solid ${cardBorder}`,
            borderRadius: 8,
            padding: 14,
            background: dark ? "#1b2a1b" : "#eef8ee",
          }}
        >
          <h3 style={{ marginTop: 0 }}>New Admin Connection</h3>
          <p style={{ marginTop: 0, fontWeight: 800 }}>
            Copy this URL now. For security, the raw token is only available immediately after creation.
          </p>
          <label style={{ display: "grid", gap: 4 }}>
            ChatGPT MCP URL
            <input readOnly value={connectorUrl} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <CopyButton value={connectorUrl} btnBorder={btnBorder}>
              Copy ChatGPT MCP URL
            </CopyButton>
          </div>
        </section>
      )}

      <section
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 8,
          padding: 14,
          background: dark ? "#151515" : "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Allowed Scopes</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DEFAULT_SCOPES.map((scope) => (
            <span
              key={scope}
              style={{
                border: `1px solid ${cardBorder}`,
                borderRadius: 6,
                padding: "4px 8px",
                background: dark ? "#222" : "#f7f7f7",
              }}
            >
              {scope}
            </span>
          ))}
        </div>
      </section>

      <section
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 8,
          padding: 14,
          background: dark ? "#151515" : "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>ChatGPT Setup</h3>
        <ol style={{ lineHeight: 1.7, marginTop: 0 }}>
          <li>Open ChatGPT.</li>
          <li>Go to Settings.</li>
          <li>Go to Apps & Connectors.</li>
          <li>Open Advanced settings and enable Developer Mode if needed.</li>
          <li>Go to Connectors.</li>
          <li>Click Create.</li>
          <li>Connector name: Tux Cashier.</li>
          <li>
            Description: ChatGPT can read Tux Cashier reports, inventory, orders, menu,
            expenses, bank summaries, and perform approved admin actions.
          </li>
          <li>Connector URL: paste the ChatGPT MCP URL shown above.</li>
          <li>Click Create.</li>
          <li>Open a new ChatGPT chat and select the Tux Cashier connector.</li>
        </ol>

        <h4 style={{ marginBottom: 8 }}>Example prompts</h4>
        <ul style={{ lineHeight: 1.7, marginTop: 0 }}>
          <li>Which admin am I connected as?</li>
          <li>Show me today's sales report.</li>
          <li>What items are low stock?</li>
          <li>Add 5kg meat to inventory.</li>
          <li>Change Double Smash Burger price to 150.</li>
          <li>Void order 12 because the customer cancelled.</li>
        </ul>
      </section>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_MCP_URL = "https://tuxcashier.vercel.app/api/mcp";
const TOKEN_WARNING =
  "Copy this token now. For security, it will only be shown once. If you lose it, revoke it and generate a new one.";

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

export default function McpConnectPanel({
  dark,
  cardBorder,
  btnBorder,
  softBg,
  adminUnlocked,
  ensureAdminUnlocked,
}) {
  const [tokenName, setTokenName] = useState("Main ChatGPT Connector");
  const [allowWrite, setAllowWrite] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [tokens, setTokens] = useState([]);
  const [createdToken, setCreatedToken] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mcpUrl = DEFAULT_MCP_URL;
  const connectorUrl = useMemo(() => {
    if (!createdToken?.token) return "";
    return `${mcpUrl}?token=${encodeURIComponent(createdToken.token)}`;
  }, [createdToken, mcpUrl]);

  const requireAdminSecret = useCallback(() => {
    if (adminSecret) return adminSecret;
    const entered = window.prompt("Enter the MCP admin secret from Vercel:", "");
    if (!entered) throw new Error("MCP admin secret is required.");
    setAdminSecret(entered);
    return entered;
  }, [adminSecret]);

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

  const loadTokens = useCallback(
    async (secretOverride) => {
      const secret = secretOverride || requireAdminSecret();
      setLoading(true);
      setError("");
      try {
        const data = await postJson("/api/mcp/token/list", { admin_secret: secret });
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        setStatus("Token list refreshed.");
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    },
    [requireAdminSecret]
  );

  useEffect(() => {
    if (!adminUnlocked || !adminSecret) return;
    loadTokens(adminSecret);
  }, [adminUnlocked, adminSecret, loadTokens]);

  const generateToken = async () => {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      if (!adminUnlocked && ensureAdminUnlocked) {
        const ok = await ensureAdminUnlocked();
        if (!ok) throw new Error("Admin unlock is required.");
      }
      const secret = requireAdminSecret();
      const data = await postJson("/api/mcp/token/create", {
        name: tokenName || "Main ChatGPT Connector",
        scopes: allowWrite ? ["read", "write"] : ["read"],
        admin_secret: secret,
      });
      setCreatedToken(data);
      setStatus(data.warning || TOKEN_WARNING);
      await loadTokens(secret);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const revokeToken = async (tokenId) => {
    if (!window.confirm("Revoke this ChatGPT connection token?")) return;
    setLoading(true);
    setError("");
    try {
      const secret = requireAdminSecret();
      await postJson("/api/mcp/token/revoke", { token_id: tokenId, admin_secret: secret });
      setStatus("Token revoked.");
      await loadTokens(secret);
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
          Generate a secure MCP connection token for this Tux Cashier shop. The raw token is shown once.
        </p>

        <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            MCP Server URL
            <input readOnly value={mcpUrl} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            Token name
            <input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={allowWrite}
              onChange={(e) => setAllowWrite(e.target.checked)}
            />
            Allow approved write/admin MCP tools
          </label>

          <label style={{ display: "grid", gap: 4, fontWeight: 700 }}>
            MCP admin secret
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Server-only secret from Vercel"
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
              Generate ChatGPT Connection Token
            </button>
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
              Refresh Token List
            </button>
            <CopyButton value={mcpUrl} btnBorder={btnBorder}>
              Copy MCP Server URL
            </CopyButton>
          </div>
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
          <h3 style={{ marginTop: 0 }}>New Token</h3>
          <p style={{ marginTop: 0, fontWeight: 800 }}>{TOKEN_WARNING}</p>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 4 }}>
              Raw token
              <input readOnly value={createdToken.token} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              Full connector URL
              <input readOnly value={connectorUrl} style={inputStyle} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <CopyButton value={createdToken.token} btnBorder={btnBorder}>
                Copy Token
              </CopyButton>
              <CopyButton value={connectorUrl} btnBorder={btnBorder}>
                Copy Full Connector URL
              </CopyButton>
            </div>
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
        <h3 style={{ marginTop: 0 }}>Existing Tokens</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                {["Name", "Prefix", "Scopes", "Status", "Created", "Last used", "Action"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cardBorder}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>{token.name || "-"}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>{token.token_prefix}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>
                    {(token.scopes || []).join(", ")}
                  </td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>
                    {token.revoked_at ? "Revoked" : token.active ? "Active" : "Inactive"}
                  </td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>
                    {token.created_at ? new Date(token.created_at).toLocaleString() : "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>
                    {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${cardBorder}` }}>
                    {token.active && !token.revoked_at ? (
                      <button
                        type="button"
                        onClick={() => revokeToken(token.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: "#c62828",
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span style={{ color: muted }}>No action</span>
                    )}
                  </td>
                </tr>
              ))}
              {!tokens.length && (
                <tr>
                  <td colSpan={7} style={{ padding: 10, color: muted }}>
                    No tokens loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
          <li>Connector URL: paste the full tokenized URL shown above.</li>
          <li>Click Create.</li>
          <li>Open a new ChatGPT chat and select the Tux Cashier connector.</li>
        </ol>

        <h4 style={{ marginBottom: 8 }}>Example prompts</h4>
        <ul style={{ lineHeight: 1.7, marginTop: 0 }}>
          <li>Show me today's sales report.</li>
          <li>What items are low stock?</li>
          <li>How much did each worker sell today?</li>
          <li>Show me order number 15.</li>
          <li>Show today's expenses and net revenue.</li>
          <li>Add 5kg meat to inventory.</li>
          <li>Change Double Smash Burger price to 150.</li>
          <li>Void order 12 because the customer cancelled.</li>
        </ul>
      </section>
    </div>
  );
}

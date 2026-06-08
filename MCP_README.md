# Tux Cashier ChatGPT MCP Setup

This document explains what changed, what to configure, and how to connect Tux Cashier to ChatGPT.

## What The MCP Integration Does

Tux Cashier now has server-side MCP endpoints for ChatGPT connectors:

- MCP server URL: `https://tuxcashier.vercel.app/api/mcp`
- Tokenized connector URL format: `https://tuxcashier.vercel.app/api/mcp?token=YOUR_GENERATED_TOKEN`
- Token management APIs:
  - `POST /api/mcp/token/create`
  - `POST /api/mcp/token/list`
  - `GET /api/mcp/token/list`
  - `POST /api/mcp/token/revoke`

The Admin tab now includes a `ChatGPT Connection` subsection. It lets an unlocked admin generate a connection token, copy the MCP URL, copy the token once, copy the full connector URL, list token metadata, and revoke existing tokens.

The website cannot automatically install a connector into your ChatGPT account. It generates the secure URL that you paste into ChatGPT manually.

## Token Security

- Raw tokens use this format: `tux_mcp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Raw tokens are shown only once after creation.
- Raw tokens are not stored in Supabase.
- Supabase stores only `token_hash`, `token_prefix`, scopes, status, and timestamps.
- Token hashing is done server-side with `sha256(token + ":" + TUX_MCP_TOKEN_PEPPER)`.
- `TUX_MCP_TOKEN_PEPPER` must be a server-only Vercel environment variable.
- `SUPABASE_SERVICE_ROLE_KEY`, `TUX_MCP_ADMIN_SECRET`, and `TUX_MCP_TOKEN_PEPPER` must never use `REACT_APP_`.
- Revoking a token marks it inactive and sets `revoked_at`; it does not physically delete the row.

## MCP Tools

Read tools require a valid MCP token with read scope:

- `get_today_sales_report`
- `get_inventory_status`
- `get_recent_orders`
- `get_order_by_number`
- `get_menu_items`
- `get_worker_sales_report`
- `get_expenses_report`
- `get_bank_summary`
- `get_current_shift`

Write/admin tools require a valid MCP token with write scope and `admin_secret`:

- `add_inventory_restock`
- `adjust_inventory_quantity`
- `update_item_price`
- `update_extra_price`
- `mark_order_done`
- `void_order`
- `add_expense`
- `change_shift`

Dangerous reset/delete/admin-bypass tools were intentionally not added.

## Supabase SQL To Run

Run this file in the Supabase SQL editor after the existing migrations:

`supabase/sql/007_mcp_tokens.sql`

It creates:

- `mcp_connection_tokens`
- `mcp_audit_logs`
- indexes for shop, token hash, active status, created date, token ID, and tool name
- RLS enabled for both MCP tables
- service-role-only policies

## Vercel Environment Variables

Add these in Vercel Project Settings -> Environment Variables:

```bash
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TUX_SHOP_ID=tux
TUX_MCP_ADMIN_SECRET=
TUX_MCP_TOKEN_PEPPER=
TUX_MCP_ALLOWED_ORIGIN=https://tuxcashier.vercel.app
TUX_PUBLIC_APP_URL=https://tuxcashier.vercel.app
```

Only `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are browser-safe. Keep the service role key, admin secret, and token pepper server-only.

Use a long random value for `TUX_MCP_ADMIN_SECRET`, and a different long random value for `TUX_MCP_TOKEN_PEPPER`.

## Deploy On Vercel

1. Commit and push the repository.
2. In Supabase, run `supabase/sql/007_mcp_tokens.sql`.
3. In Vercel, add the environment variables listed above.
4. Redeploy the project.
5. Open `https://tuxcashier.vercel.app/`.
6. Sign in to the app and unlock Admin.
7. Open `Admin -> ChatGPT Connection`.
8. Enter the MCP admin secret and generate a token.
9. Copy the full connector URL.

`vercel.json` keeps `/api/*` routed to Vercel functions and everything else routed to the CRA app.

## Connect ChatGPT

1. Open ChatGPT.
2. Go to Settings.
3. Go to Apps & Connectors.
4. Open Advanced settings and enable Developer Mode if needed.
5. Go to Connectors.
6. Click Create.
7. Connector name: `Tux Cashier`.
8. Description: `ChatGPT can read Tux Cashier reports, inventory, orders, menu, expenses, bank summaries, and perform approved admin actions.`
9. Connector URL: paste the full tokenized URL from the Admin tab.
10. Click Create.
11. Open a new ChatGPT chat and select the Tux Cashier connector.

Example prompts:

- Show me today's sales report.
- What items are low stock?
- How much did each worker sell today?
- Show me order number 15.
- Show today's expenses and net revenue.
- Add 5kg meat to inventory.
- Change Double Smash Burger price to 150.
- Void order 12 because the customer cancelled.

## Test With MCP Inspector

After deployment, test with any MCP client that supports Streamable HTTP style JSON-RPC calls.

List tools:

```bash
curl -X POST "https://tuxcashier.vercel.app/api/mcp?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Call a read tool:

```bash
curl -X POST "https://tuxcashier.vercel.app/api/mcp?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_today_sales_report","arguments":{}}}'
```

Verify these cases:

- missing token is rejected
- invalid token is rejected
- revoked token is rejected
- valid token can list tools
- valid token can call read tools
- write tools reject missing `admin_secret`
- write tools work only with valid `admin_secret` and write scope
- raw token never appears in `mcp_connection_tokens`
- `last_used_at` updates after valid MCP calls

## Refactor Notes

Safe first-pass refactor completed:

- `src/App.js` is now a small main shell.
- `src/components/layout/AppShell.js` renders the preserved POS core.
- The existing POS behavior-heavy app moved to `src/AppCore.js`.
- `src/features/mcp/McpConnectPanel.js` contains the new Admin ChatGPT Connection UI.
- `api/_lib/mcpCore.js` contains the server MCP/token logic.
- `api/mcp.js` exposes the MCP endpoint.
- `api/mcp/token/*.js` exposes token create/list/revoke routes.

Current tab/component locations:

- Orders tab: `src/AppCore.js`
- Orders Board tab: `src/AppCore.js`
- Expenses tab: `src/AppCore.js`
- Inventory Usage tab: `src/AppCore.js`
- Bulk Inventory tab: `src/AppCore.js`
- Reconcile tab: `src/AppCore.js`
- Admin Inventory subtab: `src/AppCore.js`
- Admin Purchases subtab: `src/AppCore.js`
- Admin COGS subtab: `src/AppCore.js`
- Admin Bank subtab: `src/AppCore.js`
- Admin Worker Log subtab: `src/AppCore.js`
- Admin Customer Contacts subtab: `src/AppCore.js`
- Admin Reports subtab: `src/AppCore.js`
- Admin Edit subtab: `src/AppCore.js`
- Admin ChatGPT Connection subtab: `src/features/mcp/McpConnectPanel.js`
- Admin Connected Devices subtab: `src/AppCore.js`
- Admin Settings subtab: `src/AppCore.js`

The next refactor pass should extract each `src/AppCore.js` tab block into dedicated files after adding broader browser regression tests. This pass keeps the existing POS workflow intact while moving the app entrypoint and MCP UI/server into separate files.

## Local Testing

Run:

```bash
npm.cmd install
npm.cmd test -- --watchAll=false
npm.cmd run build
```

Cloud testing requires real Vercel and Supabase environment variables. Local CRA dev server does not serve Vercel `/api/*` functions unless you use Vercel dev tooling.

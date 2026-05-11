# twenty-crm-mcp

MCP server for [Twenty CRM](https://twenty.com) — 31 tools covering full CRUD for 6 CRM entities.

## Tools

| Entity | Tools |
|--------|-------|
| People | `create_person`, `get_person`, `update_person`, `list_people`, `delete_person` |
| Companies | `create_company`, `get_company`, `update_company`, `list_companies`, `delete_company` |
| Notes | `create_note`, `get_note`, `update_note`, `list_notes`, `delete_note` |
| Tasks | `create_task`, `get_task`, `update_task`, `list_tasks`, `delete_task` |
| Opportunities | `create_opportunity`, `get_opportunity`, `update_opportunity`, `list_opportunities`, `delete_opportunity` |
| Leads | `create_lead`, `get_lead`, `update_lead`, `list_leads`, `delete_lead` |
| Schema | `get_api_schema` |

## Setup

```bash
cp .env.example .env
# fill in TWENTY_API_KEY and TWENTY_BASE_URL
bun install
```

Get API key: Twenty CRM → Settings → Playground → Generate API Key.

## Run modes

The same tool set runs in three modes:

| Mode | When to use | Entry point |
|------|-------------|-------------|
| **Stdio** | Local Claude Desktop / Inspector | `bun run server.ts` |
| **HTTP (Vercel)** | Remote MCP endpoint, multi-client | `bun run dev` → `/api/mcp` |
| **Hub route** | Embedded in `vercel-mcp-hub` | (excluded; see Hub integration) |

### Stdio (local)

```bash
bun run server
```

Server reads stdio. Connect via Claude Desktop or MCP Inspector.

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector bun run server.ts
```

Opens browser UI at `http://localhost:5173` with env vars from `.env`. Use to browse tools, call them manually, and inspect request/response shapes.

### Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "twenty-crm": {
      "command": "bun",
      "args": ["run", "/path/to/server.ts"],
      "env": {
        "TWENTY_API_KEY": "your_key",
        "TWENTY_BASE_URL": "https://your-twenty-instance.com/rest"
      }
    }
  }
}
```

## Vercel deploy (standalone HTTP MCP)

### 1. Generate bearer token

```bash
openssl rand -base64 32
```

### 2. Deploy

Push to GitHub and import via [vercel.com/new](https://vercel.com/new), or use the CLI:

```bash
npx vercel
npx vercel --prod
```

### 3. Set env vars in Vercel project

| Variable | Value |
|----------|-------|
| `TWENTY_API_KEY` | Twenty workspace API key |
| `TWENTY_BASE_URL` | `https://<your-twenty>.com/rest` |
| `MCP_BEARER_TOKEN` | Output from step 1 |
| `TWENTY_READ_ONLY` | `false` (default) or `true` to disable write tools |

Region defaults to `fra1` (see `vercel.json`). Change if Twenty is hosted elsewhere.

### 4. Verify

```bash
# Healthcheck (no auth)
curl https://<project>.vercel.app/api/health

# Tools list (requires bearer)
curl -X POST https://<project>.vercel.app/api/mcp \
  -H "Authorization: Bearer <MCP_BEARER_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### 5. Claude Desktop (remote)

```json
{
  "mcpServers": {
    "twenty-crm": {
      "url": "https://<project>.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_BEARER_TOKEN>"
      }
    }
  }
}
```

### Endpoints

| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/api/health` | GET | none | Healthcheck, returns `{status,service,version,timestamp}` |
| `/api/mcp` | POST/GET/DELETE | Bearer | MCP JSON-RPC (streamable HTTP) |

### Read-only deploys

Set `TWENTY_READ_ONLY=true` to skip registration of `create_*`, `update_*`, `delete_*` tools. The server then exposes only 13 read tools (`get_*`, `list_*`, `get_api_schema`). Useful for agent contexts that must not mutate CRM data.

## Tests

```bash
# MCP-level tool tests (via in-memory transport, hits live CRM)
bun test tests/tools.test.ts

# Evaluation suite — error handling, edge cases, multi-step workflows
bun test tests/evaluation.test.ts

# Direct REST API tests
bun test tests/api-direct.test.ts

# Type check
bun run typecheck
```

> **Warning:** CRUD tests write to the live CRM. Records are prefixed `__MCP_`, `__Test__`, or `__EVAL_` and deleted at end of each suite. Running all test files together can trigger transient dev CRM rate limiting — prefer running suites individually.

## Filter syntax

All `list_*` tools accept a `filter` param using Twenty CRM's query syntax:

```
field[COMPARATOR]:value
```

Examples:
```
name.firstName[ilike]:%john%
status[eq]:"TODO"
companyId[eq]:"uuid-here"
employees[gte]:100
```

Comparators: `eq`, `neq`, `ilike`, `gt`, `gte`, `lt`, `lte`, `in`, `is`

Pagination uses `starting_after` (pass `pageInfo.endCursor` from previous response).

## Hub integration

This server can be deployed as a route in [vercel-mcp-hub](https://github.com/abugodev/brain). Copy `app/` and `lib/` into the hub, add `twenty-crm` to the `SHARED` services array in `lib/tenants.ts`, and set `TWENTY_API_KEY` + `TWENTY_BASE_URL` in Vercel env vars.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run server        # run standalone stdio MCP server (for local testing / Claude Desktop)
bun test tests/tools.test.ts   # MCP-level tool tests via in-memory transport (hits live CRM)
bun run tests/api-direct.test.ts  # direct REST API tests, bypasses MCP layer
bun run typecheck     # tsc --noEmit
```

Single test:
```bash
bun test tests/tools.test.ts --test-name-pattern "list_people"
```

## Environment

Copy `.env.example` → `.env` before running anything:

```
TWENTY_API_KEY=...          # Twenty CRM workspace API key
TWENTY_BASE_URL=https://crm.dev.reservio.com/rest
```

API key: Twenty CRM Settings → Playground → Generate API Key.

## Architecture

Three deployment modes for the same core implementation:

**Stdio** (`server.ts`) — for MCP Inspector and Claude Desktop. Creates `McpServer`, calls `registerTwentyCrmTools`, connects `StdioServerTransport`.

**Standalone Vercel** (`app/api/[transport]/route.ts`) — Next.js App Router route. Wraps `registerTwentyCrmTools` via `createMcpHandler` (from `mcp-handler` package). Authenticated by simple Bearer token check against `MCP_BEARER_TOKEN` env var. Exposes `/api/mcp` (HTTP/SSE).

**Hub route** — not in this repo. To embed into `vercel-mcp-hub`, recreate the standalone route inside the hub and wrap with `withV4Auth` from `@/lib/auth/v4-middleware`.

### Build/run scripts

- `bun run dev` — Next.js dev server on `http://localhost:3000`
- `bun run build` — Next.js production build
- `bun run start` — start production server (after build)
- `bun run server` — stdio MCP entry (unchanged)

### Env vars

- `TWENTY_API_KEY`, `TWENTY_BASE_URL` — Twenty workspace credentials (required)
- `MCP_BEARER_TOKEN` — required when HTTP route is exposed; `/api/mcp` returns 500 if unset
- `TWENTY_READ_ONLY=true` — skip registration of `create_*`/`update_*`/`delete_*` tools (proxy in `handler.ts:wrapForReadOnly`)

### Core files

- `lib/platforms/twenty-crm.ts` — REST client. Lazy singleton, normalises `TWENTY_BASE_URL`, all HTTP via `fetch`. Exports `getTwentyCrmClient()` and `resetTwentyCrmClient()` (used in tests).
- `lib/services/twenty-crm/handler.ts` — 31 MCP tools, 6 entity modules. Exports `registerTwentyCrmTools(server)` and `twentyCrmConfig`.

### API patterns (Twenty CRM specifics)

**Composite fields** — always structured objects, never flat strings:
- name: `{ firstName, lastName }`
- emails: `{ primaryEmail }`
- body/description: `{ markdown }` stored as `bodyV2`
- amount: `{ amountMicros, currencyCode }`
- domainName/linkedinLink: `{ primaryLinkUrl }`

**Response shapes differ by operation:**
- LIST: `{ data: { notes: [...] }, pageInfo, totalCount }`
- GET: `{ data: { note: { ... } } }`
- CREATE: `{ data: { createNote: { ... } } }`
- PATCH: `{ data: { updateNote: { ... } } }`
- DELETE: `{ data: { deleteNote: { id } } }`

Use `extractMutation(raw, 'create'|'update'|'delete', singularName)` and `extractEntity(raw, singularName)` helpers in handler.ts to unwrap these.

**Pagination** — cursor-based. Params: `limit`, `starting_after` (= `pageInfo.endCursor` from previous response), `depth` (0 = flat, 1 = include relations).

**Filters** — query string syntax: `field[COMPARATOR]:value`. Comparators: `eq`, `neq`, `ilike`, `gt`, `gte`, `lt`, `lte`, `in`, `is`. Example: `name.firstName[ilike]:%john%`.

**Updates** — always PATCH, never PUT.

### Tool registration pattern

Each entity has its own `register*Tools(server, getClient)` function. All are called from `registerTwentyCrmTools`. When adding a new entity, follow the same module pattern and add it to the public export.

### Tests

`tests/tools.test.ts` — spins up MCP server + client over `InMemoryTransport`. CRUD lifecycle tests write to **production** CRM data prefixed with `__MCP_` or `__Test__` and clean up via delete at end of suite.

`tests/api-direct.test.ts` — hits the REST API directly. Useful for verifying raw response shapes when the API spec is unclear.

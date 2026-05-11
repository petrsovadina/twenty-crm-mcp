# Twenty CRM MCP — Hub Integration Guide

## Instance

Self-hosted Twenty CRM at `crm.dev.reservio.com`.
API base: `https://crm.dev.reservio.com/rest/`
Auth: Bearer token (generated in Settings > Playground)

## Files to copy into vercel-mcp-hub

```
lib/platforms/twenty-crm.ts                      → lib/platforms/twenty-crm.ts
lib/services/twenty-crm/handler.ts               → lib/services/twenty-crm/handler.ts
lib/services/twenty-crm/integration.test.ts      → lib/services/twenty-crm/integration.test.ts
app/api/twenty-crm/v4/[transport]/route.ts       → app/api/twenty-crm/v4/[transport]/route.ts
```

## Patches to existing hub files

### 1. lib/tenants.ts — add 'twenty-crm' to shared services

```diff
 const SHARED = {
   shared: {
     auth: { tokenEnvVar: 'MCP_BEARER_TOKEN' },
     services: [
       'google-sheets',
       'google-docs',
       'google-drive',
       'google-analytics',
       'google-ads',
       'slack',
       'sloneek',
+      'twenty-crm',
     ] as const,
     identify: {},
   },
 } as const
```

### 2. .env.example — add Twenty CRM vars

Append after the Sloneek section:

```
# Twenty CRM Configuration (self-hosted at crm.dev.reservio.com)
# API key: Settings → Playground → Generate API Key (workspace-scoped)
# Base URL includes /rest/ path — do not add trailing endpoints
TWENTY_API_KEY=your_twenty_api_key_here
TWENTY_BASE_URL=https://crm.dev.reservio.com/rest
```

### 3. scripts/mcp-config.ts — no changes needed

The `twenty-crm` service is declared in `shared.services`, so the existing
mcp-config generator (section 1 loop) will automatically create the entry:

```
twenty-crm → /api/twenty-crm/v4/mcp?key={MCP_BEARER_TOKEN}
```

### 4. Vercel environment variables

Set on Vercel dashboard (or via `vercel env add`):

| Variable | Value |
|----------|-------|
| `TWENTY_API_KEY` | API key from crm.dev.reservio.com Settings > Playground |
| `TWENTY_BASE_URL` | `https://crm.dev.reservio.com/rest` |

### 5. Verification

```bash
# After deploy, run smoke test
ENV=prod bun test:smoke

# Run Twenty CRM integration tests
ENV=prod bun test lib/services/twenty-crm/integration.test.ts
```

### 6. Client config for Petra

After deploy, share this with Petra for her Claude Desktop `~/.claude.json`:

```json
{
  "mcpServers": {
    "twenty-crm": {
      "type": "http",
      "url": "https://abugo-mcps.vercel.app/api/twenty-crm/v4/mcp?key=<MCP_BEARER_TOKEN>"
    }
  }
}
```

## Tool inventory (31 tools)

### People (5): create_person, get_person, update_person, list_people, delete_person
### Companies (5): create_company, get_company, update_company, list_companies, delete_company
### Tasks (5): create_task, get_task, update_task, list_tasks, delete_task
### Notes (5): create_note, get_note, update_note, list_notes, delete_note
### Opportunities (5): create_opportunity, get_opportunity, update_opportunity, list_opportunities, delete_opportunity
### Leads (5): create_lead, get_lead, update_lead, list_leads, delete_lead
### Schema (1): get_api_schema

## API notes

- **Pagination**: cursor-based. Use `limit` (max 200) and `starting_after` (from `pageInfo.endCursor`)
- **Filtering**: `filter=field[COMPARATOR]:value` — comparators: eq, neq, ilike, gt, gte, lt, lte, in, is
- **Updates**: PATCH (not PUT)
- **Body format**: Notes and Tasks use `bodyV2: { markdown: "..." }`, not plain `body`
- **Name**: People use `name: { firstName, lastName }` composite object
- **Emails**: People use `emails: { primaryEmail }` composite object
- **Addresses**: Companies use `address: { addressStreet1, addressCity, addressCountry, ... }` composite
- **Soft delete**: Records get `deletedAt` timestamp, can be restored via `/restore/` endpoints
- **Response nesting**: CREATE → `data.createPerson`, UPDATE → `data.updatePerson`, GET → `data.person`, LIST → `data.people`

## Step-by-step integration checklist

```
[ ] 1. cd do vercel-mcp-hub repo
[ ] 2. git checkout -b feat/twenty-crm-v4
[ ] 3. Zkopírovat soubory z hub-integration/files-to-copy/ do kořene hubu:
       cp -r hub-integration/files-to-copy/* /path/to/vercel-mcp-hub/
[ ] 4. Upravit lib/tenants.ts — přidat 'twenty-crm' do shared.services (viz diff výše)
[ ] 5. Upravit .env.example — přidat TWENTY_API_KEY a TWENTY_BASE_URL
[ ] 6. Přidat do .env lokálně:
       TWENTY_API_KEY=<klíč>
       TWENTY_BASE_URL=https://crm.dev.reservio.com/rest
[ ] 7. bun install (žádné nové deps — vše už je v hubu)
[ ] 8. bun run typecheck
[ ] 9. bun run dev → otestovat http://localhost:8000/api/twenty-crm/v4/mcp?key=<MCP_BEARER_TOKEN>
[ ] 10. bun test lib/services/twenty-crm/integration.test.ts
[ ] 11. git add + commit + push
[ ] 12. gh pr create
[ ] 13. Nastavit Vercel env vars: TWENTY_API_KEY, TWENTY_BASE_URL
[ ] 14. Deploy (Vercel preview z PR)
[ ] 15. ENV=prod bun test:smoke — ověřit twenty-crm endpoint
[ ] 16. Merge PR
[ ] 17. Sdílet connection details s Petrou (viz sekce 6 výše)
```

## Boris's PR #4

PR abugodev/vercel-mcp-hub#4 (feat/twenty-crm-mcp) je zastaralý — používá:
- stdio transport (nefunguje na Vercelu)
- offset pagination (Twenty API používá cursor-based)
- PUT updates (Twenty API používá PATCH)
- špatný response parsing (nové API vrací nested data)
- chybějící entity (Leads, Opportunities)

Doporučení: **zavřít PR #4** s komentářem, že integrace proběhla přes nový PR podle v4 hub patternu.

/**
 * Integration tests for Twenty CRM MCP tools (v4).
 *
 * Tests READ-ONLY tools against the actual Twenty CRM instance at
 * crm.dev.reservio.com to avoid side effects on Petra's CRM data.
 *
 * Read-only tools tested:
 *   - list_people, list_companies, list_tasks, list_notes
 *   - list_leads, list_opportunities
 *   - get_api_schema
 *
 * NOT tested (destructive):
 *   - create_*, update_*, delete_* for all object types
 *   - get_* by ID (need valid IDs from the live instance)
 *
 * Usage:
 *   bun test lib/services/twenty-crm/integration.test.ts          (dev, localhost:8000)
 *   ENV=prod bun test lib/services/twenty-crm/integration.test.ts (production)
 */
import { describe, expect, test } from 'bun:test'
import { mcpServers } from '../../../scripts/mcp-config'
import { callMCP } from '../../../tests/helpers/mcp'

const env = (process.env.ENV || 'dev') as 'dev' | 'prod'

const config = mcpServers['twenty-crm']
if (!config) throw new Error('twenty-crm not found in mcpServers')
const url = config.v4[env === 'dev' ? 'dev_url' : 'prod_url']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function callTwentyCrm(toolName: string, args: Record<string, unknown>) {
  return callMCP(url, 'tools/call', { name: toolName, arguments: args })
}

function parseResult(res: { result?: Record<string, unknown> }) {
  const content = res.result!.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0].text)
}

function expectSuccess(res: {
  result?: Record<string, unknown>
  error?: unknown
}) {
  if (res.result?.isError) {
    const content = res.result.content as Array<{
      type: string
      text: string
    }>
    throw new Error(
      `MCP tool error: ${content?.[0]?.text ?? JSON.stringify(res.result)}`,
    )
  }
  expect(res.error).toBeUndefined()
  expect(res.result).toBeDefined()
}

// ─── Server initialization ────────────────────────────────────────────────────

describe('twenty-crm server', () => {
  test('initialize succeeds', async () => {
    const res = await callMCP(url, 'initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' },
    })
    expect(res.error).toBeUndefined()
    expect(res.result).toBeDefined()
  })

  test('tools/list returns twenty-crm tools', async () => {
    const res = await callMCP(url, 'tools/list', {})
    expectSuccess(res)
    const tools = res.result!.tools as Array<{ name: string }>
    expect(tools).toBeArray()

    const toolNames = tools.map((t) => t.name)
    // Core CRM tools
    expect(toolNames).toContain('list_people')
    expect(toolNames).toContain('list_companies')
    expect(toolNames).toContain('create_task')
    expect(toolNames).toContain('create_opportunity')
    expect(toolNames).toContain('create_lead')
    expect(toolNames).toContain('get_api_schema')

    // Should have 5 tools per entity (6 entities) + 1 schema tool = 31
    expect(tools.length).toBeGreaterThanOrEqual(30)
  })
})

// ─── Read-only integration tests ──────────────────────────────────────────────

describe('twenty-crm read-only tools', () => {
  test('list_people returns cursor-paginated results', async () => {
    const res = await callTwentyCrm('list_people', { limit: 3 })
    expectSuccess(res)
    const data = parseResult(res)
    // Twenty CRM response: { data: { people: [...] }, pageInfo, totalCount }
    expect(data).toBeDefined()
    expect(data.data).toBeDefined()
    expect(data.data.people).toBeArray()
    if (data.pageInfo) {
      expect(typeof data.pageInfo.hasNextPage).toBe('boolean')
    }
  }, 15_000)

  test('list_companies returns results', async () => {
    const res = await callTwentyCrm('list_companies', { limit: 3 })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
    expect(data.data).toBeDefined()
    expect(data.data.companies).toBeArray()
  }, 15_000)

  test('list_tasks returns results', async () => {
    const res = await callTwentyCrm('list_tasks', { limit: 3 })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
    expect(data.data).toBeDefined()
    expect(data.data.tasks).toBeArray()
  }, 15_000)

  test('list_notes returns results', async () => {
    const res = await callTwentyCrm('list_notes', { limit: 3 })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
    expect(data.data).toBeDefined()
    expect(data.data.notes).toBeArray()
  }, 15_000)

  test('list_opportunities returns results', async () => {
    const res = await callTwentyCrm('list_opportunities', { limit: 3 })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
    expect(data.data).toBeDefined()
    expect(data.data.opportunities).toBeArray()
  }, 15_000)

  test('list_leads returns results', async () => {
    const res = await callTwentyCrm('list_leads', { limit: 3 })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
    expect(data.data).toBeDefined()
    expect(data.data.leads).toBeArray()
  }, 15_000)

  test('list_people with filter', async () => {
    const res = await callTwentyCrm('list_people', {
      limit: 5,
      filter: 'name.firstName[ilike]:%a%',
    })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
  }, 15_000)

  test('list_tasks filtered by status', async () => {
    const res = await callTwentyCrm('list_tasks', {
      limit: 5,
      filter: 'status[eq]:"TODO"',
    })
    expectSuccess(res)
    const data = parseResult(res)
    expect(data).toBeDefined()
  }, 15_000)

  test('get_api_schema returns endpoint listing', async () => {
    const res = await callTwentyCrm('get_api_schema', {})
    expectSuccess(res)
    const data = parseResult(res)
    expect(data.endpoints).toBeGreaterThan(0)
    expect(data.paths).toBeArray()
    expect(data.schemaNames).toBeArray()
    expect(data.paths).toContain('/people')
    expect(data.paths).toContain('/companies')
  }, 30_000)
})

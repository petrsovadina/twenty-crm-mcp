/**
 * MCP-level tool tests — spins up the MCP server in-process,
 * registers all tools, and calls each one through the MCP SDK client.
 *
 * Tests all 31 tools: 6 entities × 5 CRUD + 1 schema tool.
 * Read-only tools run against production data.
 * Write tools (create/update/delete) run a lifecycle on a test record and clean up.
 *
 * Usage: bun test tests/tools.test.ts
 */

import { describe, test, expect } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { registerTwentyCrmTools } from '../lib/services/twenty-crm/handler'

// ─── Setup ────────────────────────────────────────────────────────────────────

let client: Client

async function setup() {
  const server = new McpServer({ name: 'twenty-crm-test', version: '1.0.0' })
  registerTwentyCrmTools(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '1.0.0' })
  await client.connect(clientTransport)
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0].text)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('twenty-crm MCP tools', () => {
  test('setup — connect in-memory server + client', async () => {
    await setup()
  })

  test('tools/list returns all 31 tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names.length).toBe(31)

    // Check all entities are covered
    for (const entity of ['person', 'company', 'note', 'task', 'opportunity', 'lead']) {
      expect(names).toContain(`create_${entity}`)
      expect(names).toContain(`get_${entity}`)
      expect(names).toContain(`update_${entity}`)
      const plural = entity === 'person' ? 'people'
        : entity === 'company' ? 'companies'
        : entity === 'opportunity' ? 'opportunities'
        : `${entity}s`
      expect(names).toContain(`list_${plural}`)
      expect(names).toContain(`delete_${entity}`)
    }
    expect(names).toContain('get_api_schema')
  })

  // ─── Read-only: list all entities ─────────────────────────────────────────

  test('list_people', async () => {
    const data = await callTool('list_people', { limit: 3 })
    expect(data.data.people).toBeArray()
    expect(data.totalCount).toBeNumber()
  }, 15_000)

  test('list_companies', async () => {
    const data = await callTool('list_companies', { limit: 3 })
    expect(data.data.companies).toBeArray()
  }, 15_000)

  test('list_tasks', async () => {
    const data = await callTool('list_tasks', { limit: 3 })
    expect(data.data.tasks).toBeArray()
  }, 15_000)

  test('list_notes', async () => {
    const data = await callTool('list_notes', { limit: 3 })
    expect(data.data.notes).toBeArray()
  }, 15_000)

  test('list_opportunities', async () => {
    const data = await callTool('list_opportunities', { limit: 3 })
    expect(data.data.opportunities).toBeArray()
  }, 15_000)

  test('list_leads', async () => {
    const data = await callTool('list_leads', { limit: 3 })
    expect(data.data.leads).toBeArray()
  }, 15_000)

  // ─── Read-only: filters ───────────────────────────────────────────────────

  test('list_people with filter', async () => {
    const data = await callTool('list_people', {
      limit: 5,
      filter: 'name.firstName[ilike]:%a%',
    })
    expect(data.data.people).toBeArray()
  }, 15_000)

  test('list_leads with filter', async () => {
    const data = await callTool('list_leads', {
      limit: 5,
      filter: 'name[ilike]:%a%',
    })
    expect(data.data.leads).toBeArray()
  }, 15_000)

  // ─── Schema ───────────────────────────────────────────────────────────────

  test('get_api_schema', async () => {
    const data = await callTool('get_api_schema')
    expect(data.endpoints).toBeGreaterThan(50)
    expect(data.paths).toContain('/people')
    expect(data.paths).toContain('/companies')
    expect(data.paths).toContain('/opportunities')
    expect(data.paths).toContain('/leads')
  }, 30_000)

  // ─── CRUD lifecycle: Note ─────────────────────────────────────────────────

  let noteId: string

  test('create_note', async () => {
    const data = await callTool('create_note', {
      title: '__MCP_TOOL_TEST__',
      body: 'Tool test note',
    })
    expect(data.id).toBeString()
    expect(data.title).toBe('__MCP_TOOL_TEST__')
    noteId = data.id
  }, 15_000)

  test('get_note', async () => {
    expect(noteId).toBeDefined()
    const data = await callTool('get_note', { id: noteId })
    expect(data.id).toBe(noteId)
    expect(data.title).toBe('__MCP_TOOL_TEST__')
  }, 15_000)

  test('update_note', async () => {
    expect(noteId).toBeDefined()
    const data = await callTool('update_note', {
      id: noteId,
      title: '__MCP_TOOL_TEST_UPDATED__',
    })
    expect(data.id).toBe(noteId)
    expect(data.title).toBe('__MCP_TOOL_TEST_UPDATED__')
  }, 15_000)

  test('delete_note', async () => {
    expect(noteId).toBeDefined()
    const data = await callTool('delete_note', { id: noteId })
    expect(data.id).toBe(noteId)
    expect(data.deleted).toBe(true)
  }, 15_000)

  // ─── CRUD lifecycle: Person ───────────────────────────────────────────────

  let personId: string

  test('create_person', async () => {
    const data = await callTool('create_person', {
      firstName: '__Test__',
      lastName: '__McpPerson__',
      email: 'mcp-test@example.com',
    })
    expect(data.id).toBeString()
    expect(data.name.firstName).toBe('__Test__')
    personId = data.id
  }, 15_000)

  test('get_person', async () => {
    expect(personId).toBeDefined()
    const data = await callTool('get_person', { id: personId })
    expect(data.id).toBe(personId)
  }, 15_000)

  test('update_person', async () => {
    expect(personId).toBeDefined()
    const data = await callTool('update_person', {
      id: personId,
      firstName: '__TestUpdated__',
    })
    expect(data.id).toBe(personId)
  }, 15_000)

  test('delete_person', async () => {
    expect(personId).toBeDefined()
    const data = await callTool('delete_person', { id: personId })
    expect(data.id).toBe(personId)
  }, 15_000)

  // ─── CRUD lifecycle: Company ──────────────────────────────────────────────

  let companyId: string

  test('create_company', async () => {
    const data = await callTool('create_company', {
      name: '__MCP_Test_Company__',
    })
    expect(data.id).toBeString()
    expect(data.name).toBe('__MCP_Test_Company__')
    companyId = data.id
  }, 15_000)

  test('get_company', async () => {
    expect(companyId).toBeDefined()
    const data = await callTool('get_company', { id: companyId })
    expect(data.id).toBe(companyId)
  }, 15_000)

  test('update_company', async () => {
    expect(companyId).toBeDefined()
    const data = await callTool('update_company', {
      id: companyId,
      name: '__MCP_Test_Company_Updated__',
    })
    expect(data.id).toBe(companyId)
  }, 15_000)

  test('delete_company', async () => {
    expect(companyId).toBeDefined()
    const data = await callTool('delete_company', { id: companyId })
    expect(data.id).toBe(companyId)
  }, 15_000)

  // ─── CRUD lifecycle: Lead ─────────────────────────────────────────────────

  let leadId: string

  test('create_lead', async () => {
    const data = await callTool('create_lead', {
      name: '__MCP_Test_Lead__',
      email: 'mcp-lead-test@example.com',
    })
    expect(data.id).toBeString()
    expect(data.name).toBe('__MCP_Test_Lead__')
    leadId = data.id
  }, 15_000)

  test('get_lead', async () => {
    expect(leadId).toBeDefined()
    const data = await callTool('get_lead', { id: leadId })
    expect(data.id).toBe(leadId)
  }, 15_000)

  test('update_lead', async () => {
    expect(leadId).toBeDefined()
    const data = await callTool('update_lead', {
      id: leadId,
      name: '__MCP_Test_Lead_Updated__',
    })
    expect(data.id).toBe(leadId)
  }, 15_000)

  test('delete_lead', async () => {
    expect(leadId).toBeDefined()
    const data = await callTool('delete_lead', { id: leadId })
    expect(data.id).toBe(leadId)
  }, 15_000)

  // ─── CRUD lifecycle: Opportunity ──────────────────────────────────────────

  let opportunityId: string

  test('create_opportunity', async () => {
    const data = await callTool('create_opportunity', {
      name: '__MCP_Test_Opportunity__',
      stage: 'NEW',
    })
    expect(data.id).toBeString()
    expect(data.name).toBe('__MCP_Test_Opportunity__')
    opportunityId = data.id
  }, 15_000)

  test('get_opportunity', async () => {
    expect(opportunityId).toBeDefined()
    const data = await callTool('get_opportunity', { id: opportunityId })
    expect(data.id).toBe(opportunityId)
  }, 15_000)

  test('update_opportunity', async () => {
    expect(opportunityId).toBeDefined()
    const data = await callTool('update_opportunity', {
      id: opportunityId,
      stage: 'SCREENING',
    })
    expect(data.id).toBe(opportunityId)
  }, 15_000)

  test('delete_opportunity', async () => {
    expect(opportunityId).toBeDefined()
    const data = await callTool('delete_opportunity', { id: opportunityId })
    expect(data.id).toBe(opportunityId)
  }, 15_000)

  // ─── CRUD lifecycle: Task ─────────────────────────────────────────────────

  let taskId: string

  test('create_task', async () => {
    const data = await callTool('create_task', {
      title: '__MCP_Test_Task__',
      status: 'TODO',
    })
    expect(data.id).toBeString()
    expect(data.title).toBe('__MCP_Test_Task__')
    expect(data.status).toBe('TODO')
    taskId = data.id
  }, 15_000)

  test('get_task', async () => {
    expect(taskId).toBeDefined()
    const data = await callTool('get_task', { id: taskId })
    expect(data.id).toBe(taskId)
  }, 15_000)

  test('update_task', async () => {
    expect(taskId).toBeDefined()
    const data = await callTool('update_task', {
      id: taskId,
      status: 'IN_PROGRESS',
    })
    expect(data.id).toBe(taskId)
    expect(data.status).toBe('IN_PROGRESS')
  }, 15_000)

  test('delete_task', async () => {
    expect(taskId).toBeDefined()
    const data = await callTool('delete_task', { id: taskId })
    expect(data.id).toBe(taskId)
  }, 15_000)
})

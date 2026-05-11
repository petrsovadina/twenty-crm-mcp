/**
 * Evaluation test suite — error handling, edge cases, and multi-step workflows.
 *
 * Complements tests/tools.test.ts (happy path CRUD) with:
 *   Suite 1: Error handling — non-existent IDs, invalid enums, missing required fields
 *   Suite 2: Edge cases — empty results, filter operators, pagination consistency
 *   Suite 3: Multi-step workflows — sales pipeline, task lifecycle, lead source filter
 *
 * Uses live CRM at crm.dev.reservio.com.
 * Records prefixed __EVAL_ are deleted at end of each suite via afterAll.
 *
 * Usage: bun test tests/evaluation.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { registerTwentyCrmTools } from '../lib/services/twenty-crm/handler'

// ─── Setup ────────────────────────────────────────────────────────────────────

let client: Client

beforeAll(async () => {
  const server = new McpServer({ name: 'twenty-crm-eval', version: '1.0.0' })
  registerTwentyCrmTools(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'eval-client', version: '1.0.0' })
  await client.connect(clientTransport)
})

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0].text)
}

async function callToolRaw(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args })
}

// ─── Suite 1: Error Handling ──────────────────────────────────────────────────

describe('Suite 1: Error Handling', () => {
  // 1a. Non-existent IDs — valid UUID format, but records don't exist (HTTP 404)
  // Twenty CRM rejects all-zero/all-F UUIDs as invalid (400), so crypto.randomUUID() is required.

  const entities: [string, string][] = [
    ['get_person', 'delete_person'],
    ['get_company', 'delete_company'],
    ['get_note', 'delete_note'],
    ['get_task', 'delete_task'],
    ['get_opportunity', 'delete_opportunity'],
    ['get_lead', 'delete_lead'],
  ]

  for (const [toolGet, toolDelete] of entities) {
    test(`${toolGet} — non-existent ID returns isError`, async () => {
      const result = await callToolRaw(toolGet, { id: crypto.randomUUID() })
      expect(result.isError).toBe(true)
    }, 15_000)

    test(`${toolDelete} — non-existent ID returns isError`, async () => {
      const result = await callToolRaw(toolDelete, { id: crypto.randomUUID() })
      expect(result.isError).toBe(true)
    }, 15_000)
  }

  // 1b. Invalid enum values — Zod rejects before the request reaches the API

  test('create_task — invalid status enum rejected at Zod boundary', async () => {
    const result = await callToolRaw('create_task', {
      title: '__EVAL_should_not_create__',
      status: 'INVALID_STATUS',
    })
    expect(result.isError).toBe(true)
  }, 10_000)

  test('create_opportunity — invalid stage enum rejected at Zod boundary', async () => {
    const result = await callToolRaw('create_opportunity', {
      name: '__EVAL_should_not_create__',
      stage: 'INVALID_STAGE',
    })
    expect(result.isError).toBe(true)
  }, 10_000)

  // 1c. Missing required fields — Zod boundary
  // Note: create_company({}) is NOT tested here — name: z.string() accepts empty string
  // and the Twenty CRM API also accepts empty company name.

  test('create_task — missing title returns isError', async () => {
    const result = await callToolRaw('create_task', {})
    expect(result.isError).toBe(true)
  }, 10_000)

  test('create_opportunity — missing name returns isError', async () => {
    const result = await callToolRaw('create_opportunity', {})
    expect(result.isError).toBe(true)
  }, 10_000)
})

// ─── Suite 2: Edge Cases ──────────────────────────────────────────────────────

describe('Suite 2: Edge Cases', () => {
  // 2a. Empty result sets — filter that matches nothing should return [] + totalCount 0

  test('list_people — unmatched filter returns empty array + totalCount 0', async () => {
    const data = await callTool('list_people', {
      filter: 'name.firstName[eq]:"__NONEXISTENT_9z9z9__"',
    })
    expect(data.data.people).toEqual([])
    expect(data.totalCount).toBe(0)
  }, 15_000)

  test('list_companies — unmatched filter returns empty array + totalCount 0', async () => {
    const data = await callTool('list_companies', {
      filter: 'name[eq]:"__NONEXISTENT_9z9z9__"',
    })
    expect(data.data.companies).toEqual([])
    expect(data.totalCount).toBe(0)
  }, 15_000)

  test('list_tasks — unmatched filter returns empty array + totalCount 0', async () => {
    const data = await callTool('list_tasks', {
      filter: 'title[eq]:"__NONEXISTENT_9z9z9__"',
    })
    expect(data.data.tasks).toEqual([])
    expect(data.totalCount).toBe(0)
  }, 15_000)

  test('list_notes — unmatched filter returns empty array + totalCount 0', async () => {
    const data = await callTool('list_notes', {
      filter: 'title[eq]:"__NONEXISTENT_9z9z9__"',
    })
    expect(data.data.notes).toEqual([])
    expect(data.totalCount).toBe(0)
  }, 15_000)

  test('list_leads — unmatched filter returns empty array + totalCount 0', async () => {
    const data = await callTool('list_leads', {
      filter: 'name[eq]:"__NONEXISTENT_9z9z9__"',
    })
    expect(data.data.leads).toEqual([])
    expect(data.totalCount).toBe(0)
  }, 15_000)

  // 2b. Filter operators not covered in tools.test.ts

  test('[neq] — list_tasks where status != DONE', async () => {
    const data = await callTool('list_tasks', {
      limit: 5,
      filter: 'status[neq]:"DONE"',
    })
    expect(data.data.tasks).toBeArray()
    expect(data.totalCount).toBeNumber()
  }, 15_000)

  test('[gte] — list_companies where employees >= 1', async () => {
    const data = await callTool('list_companies', {
      limit: 5,
      filter: 'employees[gte]:1',
    })
    expect(data.data.companies).toBeArray()
  }, 15_000)

  test('[lte] — list_companies where employees <= 999999', async () => {
    const data = await callTool('list_companies', {
      limit: 5,
      filter: 'employees[lte]:999999',
    })
    expect(data.data.companies).toBeArray()
  }, 15_000)

  test('[is]:NULL — list_tasks where assigneeId is null', async () => {
    // Twenty CRM requires uppercase NULL for the [is] operator
    const data = await callTool('list_tasks', {
      limit: 5,
      filter: 'assigneeId[is]:NULL',
    })
    expect(data.data.tasks).toBeArray()
    expect(data.totalCount).toBeNumber()
  }, 15_000)

  // 2c. Pagination consistency — page 2 IDs must not overlap with page 1

  test('cursor pagination — no overlap between page 1 and page 2', async () => {
    const page1 = await callTool('list_leads', { limit: 2 })
    expect(page1.data.leads).toBeArray()

    if (!page1.pageInfo?.hasNextPage) {
      // Fewer than 3 leads in CRM — pagination cannot be verified, pass vacuously
      return
    }

    const endCursor: string = page1.pageInfo.endCursor
    expect(endCursor).toBeString()

    const page2 = await callTool('list_leads', { limit: 2, starting_after: endCursor })
    expect(page2.data.leads).toBeArray()

    const page1Ids = new Set<string>(
      (page1.data.leads as Array<{ id: string }>).map((l) => l.id),
    )
    for (const lead of page2.data.leads as Array<{ id: string }>) {
      expect(page1Ids.has(lead.id)).toBe(false)
    }
  }, 30_000)
})

// ─── Suite 3: Multi-Step Workflows ────────────────────────────────────────────

describe('Suite 3: Multi-Step Workflows', () => {
  // 3a. Sales pipeline: company → person → opportunity → update stage → verify

  describe('3a. Sales pipeline', () => {
    let companyId: string | undefined
    let personId: string | undefined
    let oppId: string | undefined

    afterAll(async () => {
      if (oppId) await callTool('delete_opportunity', { id: oppId }).catch(() => {})
      if (personId) await callTool('delete_person', { id: personId }).catch(() => {})
      if (companyId) await callTool('delete_company', { id: companyId }).catch(() => {})
    })

    test('create company', async () => {
      const data = await callTool('create_company', { name: '__EVAL_Company__' })
      expect(data.id).toBeString()
      companyId = data.id
    }, 15_000)

    test('create person linked to company', async () => {
      expect(companyId).toBeDefined()
      const data = await callTool('create_person', {
        firstName: '__EVAL__',
        lastName: '__Person__',
        companyId,
      })
      expect(data.id).toBeString()
      personId = data.id
    }, 15_000)

    test('create opportunity linked to company + person', async () => {
      expect(companyId).toBeDefined()
      expect(personId).toBeDefined()
      const data = await callTool('create_opportunity', {
        name: '__EVAL_Deal__',
        stage: 'NEW',
        companyId,
        pointOfContactId: personId,
      })
      expect(data.id).toBeString()
      expect(data.stage).toBe('NEW')
      oppId = data.id
    }, 15_000)

    test('update opportunity stage to SCREENING', async () => {
      expect(oppId).toBeDefined()
      const data = await callTool('update_opportunity', {
        id: oppId,
        stage: 'SCREENING',
      })
      expect(data.stage).toBe('SCREENING')
    }, 15_000)

    test('get opportunity — stage persisted as SCREENING', async () => {
      expect(oppId).toBeDefined()
      const data = await callTool('get_opportunity', { id: oppId })
      expect(data.stage).toBe('SCREENING')
    }, 15_000)
  })

  // 3b. Task lifecycle: TODO → IN_PROGRESS → DONE → verify via get + filtered list

  describe('3b. Task lifecycle', () => {
    let taskId: string | undefined

    afterAll(async () => {
      if (taskId) await callTool('delete_task', { id: taskId }).catch(() => {})
    })

    test('create task with status TODO', async () => {
      const data = await callTool('create_task', {
        title: '__EVAL_Task__',
        status: 'TODO',
      })
      expect(data.id).toBeString()
      expect(data.status).toBe('TODO')
      taskId = data.id
    }, 15_000)

    test('update task to IN_PROGRESS', async () => {
      expect(taskId).toBeDefined()
      const data = await callTool('update_task', {
        id: taskId,
        status: 'IN_PROGRESS',
      })
      expect(data.status).toBe('IN_PROGRESS')
    }, 15_000)

    test('update task to DONE', async () => {
      expect(taskId).toBeDefined()
      const data = await callTool('update_task', { id: taskId, status: 'DONE' })
      expect(data.status).toBe('DONE')
    }, 15_000)

    test('get task — status persisted as DONE', async () => {
      expect(taskId).toBeDefined()
      const data = await callTool('get_task', { id: taskId })
      expect(data.status).toBe('DONE')
    }, 15_000)

    test('list_tasks filtered by DONE — contains our task', async () => {
      expect(taskId).toBeDefined()
      const data = await callTool('list_tasks', {
        filter: 'status[eq]:"DONE"',
        limit: 50,
      })
      const ids = (data.data.tasks as Array<{ id: string }>).map((t) => t.id)
      expect(ids).toContain(taskId as string)
    }, 15_000)
  })

  // 3c. Lead source filter: create with source, verify filter finds it

  describe('3c. Lead source filter', () => {
    let leadId: string | undefined

    afterAll(async () => {
      if (leadId) await callTool('delete_lead', { id: leadId }).catch(() => {})
    })

    test('create lead with source "website"', async () => {
      const data = await callTool('create_lead', {
        name: '__EVAL_Lead__',
        source: 'website',
      })
      expect(data.id).toBeString()
      leadId = data.id
    }, 15_000)

    test('list_leads filtered by source website — contains our lead', async () => {
      expect(leadId).toBeDefined()
      const data = await callTool('list_leads', {
        filter: 'source[eq]:"website"',
        limit: 50,
      })
      const ids = (data.data.leads as Array<{ id: string }>).map((l) => l.id)
      expect(ids).toContain(leadId as string)
    }, 15_000)
  })
})

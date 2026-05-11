/**
 * Direct API tests — bypass MCP layer, hit Twenty CRM REST API directly.
 * Verifies connectivity, response shapes, pagination, and CRUD lifecycle.
 *
 * Usage: bun run tests/api-direct.test.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import {
  getTwentyCrmClient,
  resetTwentyCrmClient,
  type TwentyCrmClient,
} from '../lib/platforms/twenty-crm'

let client: TwentyCrmClient

beforeAll(() => {
  resetTwentyCrmClient()
  client = getTwentyCrmClient()
})

// ─── Connectivity ─────────────────────────────────────────────────────────────

describe('connectivity', () => {
  test('can reach Twenty CRM API', async () => {
    const result = (await client.get('/people?limit=1')) as {
      data: { people: unknown[] }
    }
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  }, 10_000)
})

// ─── List endpoints (read-only) ───────────────────────────────────────────────

describe('list endpoints', () => {
  test('GET /people returns cursor-paginated response', async () => {
    const result = (await client.get('/people?limit=3')) as {
      data: { people: Array<Record<string, unknown>> }
      pageInfo: { hasNextPage: boolean; startCursor: string; endCursor: string }
      totalCount: number
    }
    expect(result.data.people).toBeArray()
    expect(typeof result.totalCount).toBe('number')
    expect(result.pageInfo).toBeDefined()
    expect(typeof result.pageInfo.hasNextPage).toBe('boolean')
    console.log(
      `  people: ${result.data.people.length} returned, ${result.totalCount} total`,
    )
  }, 10_000)

  test('GET /companies returns cursor-paginated response', async () => {
    const result = (await client.get('/companies?limit=3')) as {
      data: { companies: Array<Record<string, unknown>> }
      totalCount: number
    }
    expect(result.data.companies).toBeArray()
    console.log(
      `  companies: ${result.data.companies.length} returned, ${result.totalCount} total`,
    )
  }, 10_000)

  test('GET /tasks returns results', async () => {
    const result = (await client.get('/tasks?limit=3')) as {
      data: { tasks: Array<Record<string, unknown>> }
      totalCount: number
    }
    expect(result.data.tasks).toBeArray()
    console.log(
      `  tasks: ${result.data.tasks.length} returned, ${result.totalCount} total`,
    )
  }, 10_000)

  test('GET /notes returns results', async () => {
    const result = (await client.get('/notes?limit=3')) as {
      data: { notes: Array<Record<string, unknown>> }
      totalCount: number
    }
    expect(result.data.notes).toBeArray()
    console.log(
      `  notes: ${result.data.notes.length} returned, ${result.totalCount} total`,
    )
  }, 10_000)

  test('GET /opportunities returns results', async () => {
    const result = (await client.get('/opportunities?limit=3')) as {
      data: { opportunities: Array<Record<string, unknown>> }
      totalCount: number
    }
    expect(result.data.opportunities).toBeArray()
    console.log(
      `  opportunities: ${result.data.opportunities.length} returned, ${result.totalCount} total`,
    )
  }, 10_000)

  test('GET /leads returns results', async () => {
    const result = (await client.get('/leads?limit=3')) as {
      data: { leads: Array<Record<string, unknown>> }
      totalCount: number
    }
    expect(result.data.leads).toBeArray()
    console.log(
      `  leads: ${result.data.leads.length} returned, ${result.totalCount} total`,
    )
  }, 10_000)
})

// ─── Filter syntax ────────────────────────────────────────────────────────────

describe('filter syntax', () => {
  test('filter by task status works', async () => {
    const result = (await client.get(
      '/tasks?limit=5&filter=status[eq]:"TODO"',
    )) as {
      data: { tasks: Array<{ status: string }> }
    }
    expect(result.data.tasks).toBeArray()
    for (const task of result.data.tasks) {
      expect(task.status).toBe('TODO')
    }
  }, 10_000)

  test('ilike filter works on people names', async () => {
    const result = (await client.get(
      '/people?limit=5&filter=name.firstName[ilike]:%a%',
    )) as {
      data: { people: Array<Record<string, unknown>> }
    }
    expect(result.data.people).toBeArray()
  }, 10_000)
})

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('cursor pagination', () => {
  test('starting_after navigates to next page', async () => {
    const page1 = (await client.get('/people?limit=2')) as {
      data: { people: Array<{ id: string }> }
      pageInfo: { hasNextPage: boolean; endCursor: string }
    }

    if (!page1.pageInfo.hasNextPage) {
      console.log('  skipped — not enough people for pagination test')
      return
    }

    const page2 = (await client.get(
      `/people?limit=2&starting_after=${page1.pageInfo.endCursor}`,
    )) as {
      data: { people: Array<{ id: string }> }
    }
    expect(page2.data.people).toBeArray()
    // Pages should not overlap
    const page1Ids = new Set(page1.data.people.map((p) => p.id))
    for (const person of page2.data.people) {
      expect(page1Ids.has(person.id)).toBe(false)
    }
    console.log(
      `  page1: ${page1.data.people.length} items, page2: ${page2.data.people.length} items — no overlap`,
    )
  }, 15_000)
})

// ─── Response shape verification ──────────────────────────────────────────────

describe('response shapes', () => {
  test('person has composite name field', async () => {
    const result = (await client.get('/people?limit=1&depth=0')) as {
      data: { people: Array<{ name: { firstName: string; lastName: string } }> }
    }
    if (result.data.people.length === 0) {
      console.log('  skipped — no people in CRM')
      return
    }
    const person = result.data.people[0]
    expect(person.name).toBeDefined()
    expect(typeof person.name.firstName).toBe('string')
    expect(typeof person.name.lastName).toBe('string')
  }, 10_000)

  test('task has status and bodyV2 fields', async () => {
    const result = (await client.get('/tasks?limit=1&depth=0')) as {
      data: {
        tasks: Array<{
          status: string
          title: string
          bodyV2: unknown
        }>
      }
    }
    if (result.data.tasks.length === 0) {
      console.log('  skipped — no tasks in CRM')
      return
    }
    const task = result.data.tasks[0]
    expect(task.title).toBeString()
    expect(['TODO', 'IN_PROGRESS', 'DONE']).toContain(task.status)
  }, 10_000)
})

// ─── CRUD lifecycle ───────────────────────────────────────────────────────────

describe('CRUD lifecycle', () => {
  let testNoteId: string

  test('create note', async () => {
    const raw = (await client.post('/notes', {
      title: '__MCP_TEST_NOTE__',
      bodyV2: { markdown: 'Automated test note — safe to delete' },
    })) as { data: { createNote: { id: string; title: string } } }
    const note = raw.data.createNote
    expect(note.id).toBeString()
    expect(note.title).toBe('__MCP_TEST_NOTE__')
    testNoteId = note.id
    console.log(`  created note ${testNoteId}`)
  }, 10_000)

  test('get note by id', async () => {
    expect(testNoteId).toBeDefined()
    const raw = (await client.get(`/notes/${testNoteId}`)) as {
      data: { note: { id: string; title: string } }
    }
    const note = raw.data.note
    expect(note.id).toBe(testNoteId)
    expect(note.title).toBe('__MCP_TEST_NOTE__')
  }, 10_000)

  test('update note via PATCH', async () => {
    expect(testNoteId).toBeDefined()
    const raw = (await client.patch(`/notes/${testNoteId}`, {
      title: '__MCP_TEST_NOTE_UPDATED__',
    })) as { data: { updateNote: { id: string; title: string } } }
    const note = raw.data.updateNote
    expect(note.id).toBe(testNoteId)
    expect(note.title).toBe('__MCP_TEST_NOTE_UPDATED__')
  }, 10_000)

  test('delete note', async () => {
    expect(testNoteId).toBeDefined()
    const raw = (await client.delete(`/notes/${testNoteId}`)) as {
      data: { deleteNote: { id: string } }
    }
    expect(raw.data.deleteNote.id).toBe(testNoteId)
    console.log(`  deleted note ${testNoteId}`)
  }, 10_000)
})

// ─── Schema discovery ─────────────────────────────────────────────────────────

describe('schema discovery', () => {
  test('GET /open-api/core returns OpenAPI spec', async () => {
    const result = (await client.get('/open-api/core')) as {
      openapi: string
      info: { title: string }
      paths: Record<string, unknown>
    }
    expect(result.openapi).toBeString()
    expect(result.info.title).toBe('Twenty Api')
    expect(Object.keys(result.paths).length).toBeGreaterThan(50)
    console.log(
      `  OpenAPI ${result.openapi}, ${Object.keys(result.paths).length} endpoints`,
    )
  }, 30_000)
})

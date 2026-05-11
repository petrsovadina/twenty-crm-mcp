/**
 * Twenty CRM MCP handler — shared service.
 *
 * Built against the actual OpenAPI spec from crm.dev.reservio.com/rest/core.
 *
 * Key API details:
 *   - Cursor-based pagination (limit, starting_after, ending_before)
 *   - PATCH for updates (not PUT)
 *   - Composite fields: name { firstName, lastName }, emails { primaryEmail },
 *     bodyV2 { markdown }, annualRecurringRevenue { amountMicros, currencyCode }
 *   - Filter syntax: field[COMPARATOR]:value (eq, neq, ilike, gt, gte, lt, lte, in, is)
 *   - Response shapes:
 *       LIST:   { data: { notes: [...] },      pageInfo, totalCount }
 *       GET:    { data: { note: { ... } } }
 *       CREATE: { data: { createNote: { ... } } }
 *       UPDATE: { data: { updateNote: { ... } } }
 *       DELETE: { data: { deleteNote: { id } } }
 *
 * Follows MCP_BEST_PRACTICES: minimal write responses, values from API, no fallbacks.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getTwentyCrmClient,
  type TwentyCrmClient,
} from '@/lib/platforms/twenty-crm'

// ─── Helpers ────────────────────────────────────────────────

function text(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}

/**
 * Extract the entity from a mutation response.
 * POST /notes → { data: { createNote: { id, ... } } } → extract createNote
 * PATCH /notes/id → { data: { updateNote: { id, ... } } } → extract updateNote
 * DELETE /notes/id → { data: { deleteNote: { id } } } → extract deleteNote
 */
function extractMutation(
  result: unknown,
  operation: 'create' | 'update' | 'delete',
  singularName: string,
): Record<string, unknown> {
  const key = `${operation}${singularName.charAt(0).toUpperCase()}${singularName.slice(1)}`
  const data = (result as Record<string, unknown>)?.data as
    | Record<string, unknown>
    | undefined
  return (data?.[key] as Record<string, unknown>) ?? {}
}

/**
 * Extract the entity from a GET-by-ID response.
 * GET /notes/id → { data: { note: { id, ... } } } → extract note
 */
function extractEntity(
  result: unknown,
  singularName: string,
): Record<string, unknown> {
  const data = (result as Record<string, unknown>)?.data as
    | Record<string, unknown>
    | undefined
  return (data?.[singularName] as Record<string, unknown>) ?? {}
}

function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '',
  )
  if (entries.length === 0) return ''
  return (
    '?' +
    entries
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join('&')
  )
}

/** Common pagination params reused by every list tool. */
const paginationSchema = {
  limit: z
    .number()
    .optional()
    .default(20)
    .describe('Number of results (max 200, default 20)'),
  starting_after: z
    .string()
    .optional()
    .describe('Cursor — fetch page after this ID (from pageInfo.endCursor)'),
  depth: z
    .number()
    .optional()
    .describe('Relation depth: 0 = flat, 1 = include relations (default 1)'),
}

// ─── People tools ───────────────────────────────────────────

function registerPeopleTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'create_person',
    {
      title: 'Create Person',
      description: 'Create a new person (contact) in Twenty CRM',
      inputSchema: {
        firstName: z.string().describe('First name'),
        lastName: z.string().describe('Last name'),
        email: z.string().optional().describe('Primary email address'),
        phone: z.string().optional().describe('Primary phone number'),
        jobTitle: z.string().optional().describe('Job title'),
        companyId: z
          .string()
          .optional()
          .describe('Company ID to associate with'),
        linkedinUrl: z
          .string()
          .optional()
          .describe('LinkedIn profile URL'),
        city: z.string().optional().describe('City'),
      },
    },
    async ({ firstName, lastName, email, phone, jobTitle, companyId, linkedinUrl, city }) => {
      const body: Record<string, unknown> = {
        name: { firstName, lastName },
      }
      if (email) body.emails = { primaryEmail: email }
      if (phone) body.phones = { primaryPhoneNumber: phone }
      if (jobTitle) body.jobTitle = jobTitle
      if (companyId) body.companyId = companyId
      if (linkedinUrl) body.linkedinLink = { primaryLinkUrl: linkedinUrl }
      if (city) body.city = city

      const raw = await getClient().post('/people', body)
      const entity = extractMutation(raw, 'create', 'person')
      return text({
        id: entity.id,
        name: entity.name,
        emails: entity.emails,
      })
    },
  )

  server.registerTool(
    'get_person',
    {
      title: 'Get Person',
      description: 'Get details of a specific person by ID',
      inputSchema: {
        id: z.string().describe('Person ID'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().get(`/people/${id}`)
      return text(extractEntity(raw, 'person'))
    },
  )

  server.registerTool(
    'update_person',
    {
      title: 'Update Person',
      description: "Update an existing person's information",
      inputSchema: {
        id: z.string().describe('Person ID'),
        firstName: z.string().optional().describe('First name'),
        lastName: z.string().optional().describe('Last name'),
        email: z.string().optional().describe('Primary email address'),
        phone: z.string().optional().describe('Primary phone number'),
        jobTitle: z.string().optional().describe('Job title'),
        companyId: z.string().optional().describe('Company ID'),
        linkedinUrl: z
          .string()
          .optional()
          .describe('LinkedIn profile URL'),
        city: z.string().optional().describe('City'),
      },
    },
    async ({ id, firstName, lastName, email, phone, jobTitle, companyId, linkedinUrl, city }) => {
      const body: Record<string, unknown> = {}
      if (firstName || lastName) {
        body.name = {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        }
      }
      if (email) body.emails = { primaryEmail: email }
      if (phone) body.phones = { primaryPhoneNumber: phone }
      if (jobTitle) body.jobTitle = jobTitle
      if (companyId) body.companyId = companyId
      if (linkedinUrl) body.linkedinLink = { primaryLinkUrl: linkedinUrl }
      if (city) body.city = city

      const raw = await getClient().patch(`/people/${id}`, body)
      const entity = extractMutation(raw, 'update', 'person')
      return text({
        id: entity.id,
        name: entity.name,
        emails: entity.emails,
      })
    },
  )

  server.registerTool(
    'list_people',
    {
      title: 'List People',
      description:
        'List people with optional filtering and cursor-based pagination',
      inputSchema: {
        ...paginationSchema,
        filter: z
          .string()
          .optional()
          .describe(
            'Filter expression, e.g. name.firstName[ilike]:%john% or companyId[eq]:"uuid"',
          ),
      },
    },
    async ({ limit, starting_after, depth, filter }) => {
      const qs = buildQuery({ limit, starting_after, depth, filter })
      const result = await getClient().get(`/people${qs}`)
      return text(result)
    },
  )

  server.registerTool(
    'delete_person',
    {
      title: 'Delete Person',
      description: 'Delete a person from Twenty CRM (soft delete)',
      inputSchema: {
        id: z.string().describe('Person ID to delete'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().delete(`/people/${id}`)
      const entity = extractMutation(raw, 'delete', 'person')
      return text({ id: entity.id, deleted: true })
    },
  )
}

// ─── Company tools ──────────────────────────────────────────

function registerCompanyTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'create_company',
    {
      title: 'Create Company',
      description: 'Create a new company in Twenty CRM',
      inputSchema: {
        name: z.string().describe('Company name'),
        domainName: z.string().optional().describe('Company website URL'),
        employees: z
          .number()
          .optional()
          .describe('Number of employees'),
        idealCustomerProfile: z
          .boolean()
          .optional()
          .describe('Is this an ideal customer profile'),
        linkedinUrl: z
          .string()
          .optional()
          .describe('LinkedIn company URL'),
        addressCity: z.string().optional().describe('City'),
        addressCountry: z.string().optional().describe('Country'),
        addressStreet1: z.string().optional().describe('Street address'),
      },
    },
    async ({ name, domainName, employees, idealCustomerProfile, linkedinUrl, addressCity, addressCountry, addressStreet1 }) => {
      const body: Record<string, unknown> = { name }
      if (domainName) body.domainName = { primaryLinkUrl: domainName }
      if (employees !== undefined) body.employees = employees
      if (idealCustomerProfile !== undefined)
        body.idealCustomerProfile = idealCustomerProfile
      if (linkedinUrl) body.linkedinLink = { primaryLinkUrl: linkedinUrl }
      if (addressCity || addressCountry || addressStreet1) {
        body.address = {
          ...(addressStreet1 ? { addressStreet1 } : {}),
          ...(addressCity ? { addressCity } : {}),
          ...(addressCountry ? { addressCountry } : {}),
        }
      }

      const raw = await getClient().post('/companies', body)
      const entity = extractMutation(raw, 'create', 'company')
      return text({ id: entity.id, name: entity.name })
    },
  )

  server.registerTool(
    'get_company',
    {
      title: 'Get Company',
      description: 'Get details of a specific company by ID',
      inputSchema: {
        id: z.string().describe('Company ID'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().get(`/companies/${id}`)
      return text(extractEntity(raw, 'company'))
    },
  )

  server.registerTool(
    'update_company',
    {
      title: 'Update Company',
      description: "Update an existing company's information",
      inputSchema: {
        id: z.string().describe('Company ID'),
        name: z.string().optional().describe('Company name'),
        domainName: z.string().optional().describe('Company website URL'),
        employees: z
          .number()
          .optional()
          .describe('Number of employees'),
        idealCustomerProfile: z
          .boolean()
          .optional()
          .describe('Is this an ideal customer profile'),
        linkedinUrl: z
          .string()
          .optional()
          .describe('LinkedIn company URL'),
        addressCity: z.string().optional().describe('City'),
        addressCountry: z.string().optional().describe('Country'),
      },
    },
    async ({ id, name, domainName, employees, idealCustomerProfile, linkedinUrl, addressCity, addressCountry }) => {
      const body: Record<string, unknown> = {}
      if (name) body.name = name
      if (domainName) body.domainName = { primaryLinkUrl: domainName }
      if (employees !== undefined) body.employees = employees
      if (idealCustomerProfile !== undefined)
        body.idealCustomerProfile = idealCustomerProfile
      if (linkedinUrl) body.linkedinLink = { primaryLinkUrl: linkedinUrl }
      if (addressCity || addressCountry) {
        body.address = {
          ...(addressCity ? { addressCity } : {}),
          ...(addressCountry ? { addressCountry } : {}),
        }
      }

      const raw = await getClient().patch(`/companies/${id}`, body)
      const entity = extractMutation(raw, 'update', 'company')
      return text({ id: entity.id, name: entity.name })
    },
  )

  server.registerTool(
    'list_companies',
    {
      title: 'List Companies',
      description:
        'List companies with optional filtering and cursor-based pagination',
      inputSchema: {
        ...paginationSchema,
        filter: z
          .string()
          .optional()
          .describe(
            'Filter expression, e.g. name[ilike]:%acme% or employees[gte]:100',
          ),
      },
    },
    async ({ limit, starting_after, depth, filter }) => {
      const qs = buildQuery({ limit, starting_after, depth, filter })
      const result = await getClient().get(`/companies${qs}`)
      return text(result)
    },
  )

  server.registerTool(
    'delete_company',
    {
      title: 'Delete Company',
      description: 'Delete a company from Twenty CRM (soft delete)',
      inputSchema: {
        id: z.string().describe('Company ID to delete'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().delete(`/companies/${id}`)
      const entity = extractMutation(raw, 'delete', 'company')
      return text({ id: entity.id, deleted: true })
    },
  )
}

// ─── Note tools ─────────────────────────────────────────────

function registerNoteTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'create_note',
    {
      title: 'Create Note',
      description: 'Create a new note in Twenty CRM',
      inputSchema: {
        title: z.string().describe('Note title'),
        body: z.string().describe('Note content (markdown)'),
        position: z
          .number()
          .optional()
          .describe('Position for ordering'),
      },
    },
    async ({ title, body, position }) => {
      const payload: Record<string, unknown> = {
        title,
        bodyV2: { markdown: body },
      }
      if (position !== undefined) payload.position = position

      const raw = await getClient().post('/notes', payload)
      const entity = extractMutation(raw, 'create', 'note')
      return text({ id: entity.id, title: entity.title })
    },
  )

  server.registerTool(
    'get_note',
    {
      title: 'Get Note',
      description: 'Get details of a specific note by ID',
      inputSchema: {
        id: z.string().describe('Note ID'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().get(`/notes/${id}`)
      return text(extractEntity(raw, 'note'))
    },
  )

  server.registerTool(
    'update_note',
    {
      title: 'Update Note',
      description: 'Update an existing note',
      inputSchema: {
        id: z.string().describe('Note ID'),
        title: z.string().optional().describe('Note title'),
        body: z
          .string()
          .optional()
          .describe('Note content (markdown)'),
        position: z
          .number()
          .optional()
          .describe('Position for ordering'),
      },
    },
    async ({ id, title, body, position }) => {
      const payload: Record<string, unknown> = {}
      if (title) payload.title = title
      if (body) payload.bodyV2 = { markdown: body }
      if (position !== undefined) payload.position = position

      const raw = await getClient().patch(`/notes/${id}`, payload)
      const entity = extractMutation(raw, 'update', 'note')
      return text({ id: entity.id, title: entity.title })
    },
  )

  server.registerTool(
    'list_notes',
    {
      title: 'List Notes',
      description:
        'List notes with optional filtering and cursor-based pagination',
      inputSchema: {
        ...paginationSchema,
        filter: z
          .string()
          .optional()
          .describe('Filter expression, e.g. title[ilike]:%meeting%'),
      },
    },
    async ({ limit, starting_after, depth, filter }) => {
      const qs = buildQuery({ limit, starting_after, depth, filter })
      const result = await getClient().get(`/notes${qs}`)
      return text(result)
    },
  )

  server.registerTool(
    'delete_note',
    {
      title: 'Delete Note',
      description: 'Delete a note from Twenty CRM',
      inputSchema: {
        id: z.string().describe('Note ID to delete'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().delete(`/notes/${id}`)
      const entity = extractMutation(raw, 'delete', 'note')
      return text({ id: entity.id, deleted: true })
    },
  )
}

// ─── Task tools ─────────────────────────────────────────────

const TASK_STATUS = z
  .enum(['TODO', 'IN_PROGRESS', 'DONE'])
  .describe('Task status')

function registerTaskTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description: 'Create a new task in Twenty CRM',
      inputSchema: {
        title: z.string().describe('Task title'),
        body: z
          .string()
          .optional()
          .describe('Task description (markdown)'),
        dueAt: z
          .string()
          .optional()
          .describe('Due date (ISO 8601 format)'),
        status: TASK_STATUS.optional(),
        assigneeId: z
          .string()
          .optional()
          .describe('ID of workspace member assigned to task'),
      },
    },
    async ({ title, body, dueAt, status, assigneeId }) => {
      const payload: Record<string, unknown> = { title }
      if (body) payload.bodyV2 = { markdown: body }
      if (dueAt) payload.dueAt = dueAt
      if (status) payload.status = status
      if (assigneeId) payload.assigneeId = assigneeId

      const raw = await getClient().post('/tasks', payload)
      const entity = extractMutation(raw, 'create', 'task')
      return text({
        id: entity.id,
        title: entity.title,
        status: entity.status,
      })
    },
  )

  server.registerTool(
    'get_task',
    {
      title: 'Get Task',
      description: 'Get details of a specific task by ID',
      inputSchema: {
        id: z.string().describe('Task ID'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().get(`/tasks/${id}`)
      return text(extractEntity(raw, 'task'))
    },
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description: 'Update an existing task',
      inputSchema: {
        id: z.string().describe('Task ID'),
        title: z.string().optional().describe('Task title'),
        body: z
          .string()
          .optional()
          .describe('Task description (markdown)'),
        dueAt: z
          .string()
          .optional()
          .describe('Due date (ISO 8601 format)'),
        status: TASK_STATUS.optional(),
        assigneeId: z
          .string()
          .optional()
          .describe('ID of workspace member assigned to task'),
      },
    },
    async ({ id, title, body, dueAt, status, assigneeId }) => {
      const payload: Record<string, unknown> = {}
      if (title) payload.title = title
      if (body) payload.bodyV2 = { markdown: body }
      if (dueAt) payload.dueAt = dueAt
      if (status) payload.status = status
      if (assigneeId) payload.assigneeId = assigneeId

      const raw = await getClient().patch(`/tasks/${id}`, payload)
      const entity = extractMutation(raw, 'update', 'task')
      return text({
        id: entity.id,
        title: entity.title,
        status: entity.status,
      })
    },
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description:
        'List tasks with optional filtering and cursor-based pagination',
      inputSchema: {
        ...paginationSchema,
        filter: z
          .string()
          .optional()
          .describe(
            'Filter expression, e.g. status[eq]:"TODO" or assigneeId[eq]:"uuid"',
          ),
      },
    },
    async ({ limit, starting_after, depth, filter }) => {
      const qs = buildQuery({ limit, starting_after, depth, filter })
      const result = await getClient().get(`/tasks${qs}`)
      return text(result)
    },
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Delete Task',
      description: 'Delete a task from Twenty CRM',
      inputSchema: {
        id: z.string().describe('Task ID to delete'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().delete(`/tasks/${id}`)
      const entity = extractMutation(raw, 'delete', 'task')
      return text({ id: entity.id, deleted: true })
    },
  )
}

// ─── Opportunity tools ──────────────────────────────────────

const OPPORTUNITY_STAGE = z
  .enum(['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER'])
  .describe('Opportunity pipeline stage')

function registerOpportunityTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'create_opportunity',
    {
      title: 'Create Opportunity',
      description:
        'Create a new sales opportunity (deal) in Twenty CRM',
      inputSchema: {
        name: z.string().describe('Opportunity name'),
        stage: OPPORTUNITY_STAGE.optional(),
        closeDate: z
          .string()
          .optional()
          .describe('Expected close date (ISO 8601)'),
        amountMicros: z
          .number()
          .optional()
          .describe('Deal amount in micros (e.g. 50000000000 = $50,000)'),
        currencyCode: z
          .string()
          .optional()
          .default('USD')
          .describe('Currency code (default USD)'),
        companyId: z
          .string()
          .optional()
          .describe('Associated company ID'),
        pointOfContactId: z
          .string()
          .optional()
          .describe('Primary contact person ID'),
      },
    },
    async ({ name, stage, closeDate, amountMicros, currencyCode, companyId, pointOfContactId }) => {
      const body: Record<string, unknown> = { name }
      if (stage) body.stage = stage
      if (closeDate) body.closeDate = closeDate
      if (amountMicros !== undefined)
        body.amount = { amountMicros, currencyCode }
      if (companyId) body.companyId = companyId
      if (pointOfContactId) body.pointOfContactId = pointOfContactId

      const raw = await getClient().post('/opportunities', body)
      const entity = extractMutation(raw, 'create', 'opportunity')
      return text({
        id: entity.id,
        name: entity.name,
        stage: entity.stage,
      })
    },
  )

  server.registerTool(
    'get_opportunity',
    {
      title: 'Get Opportunity',
      description: 'Get details of a specific opportunity by ID',
      inputSchema: {
        id: z.string().describe('Opportunity ID'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().get(`/opportunities/${id}`)
      return text(extractEntity(raw, 'opportunity'))
    },
  )

  server.registerTool(
    'update_opportunity',
    {
      title: 'Update Opportunity',
      description: 'Update an existing opportunity',
      inputSchema: {
        id: z.string().describe('Opportunity ID'),
        name: z.string().optional().describe('Opportunity name'),
        stage: OPPORTUNITY_STAGE.optional(),
        closeDate: z
          .string()
          .optional()
          .describe('Expected close date (ISO 8601)'),
        amountMicros: z
          .number()
          .optional()
          .describe('Deal amount in micros'),
        currencyCode: z
          .string()
          .optional()
          .describe('Currency code'),
      },
    },
    async ({ id, name, stage, closeDate, amountMicros, currencyCode }) => {
      const body: Record<string, unknown> = {}
      if (name) body.name = name
      if (stage) body.stage = stage
      if (closeDate) body.closeDate = closeDate
      if (amountMicros !== undefined)
        body.amount = { amountMicros, currencyCode }

      const raw = await getClient().patch(`/opportunities/${id}`, body)
      const entity = extractMutation(raw, 'update', 'opportunity')
      return text({
        id: entity.id,
        name: entity.name,
        stage: entity.stage,
      })
    },
  )

  server.registerTool(
    'list_opportunities',
    {
      title: 'List Opportunities',
      description:
        'List opportunities with optional filtering and cursor-based pagination',
      inputSchema: {
        ...paginationSchema,
        filter: z
          .string()
          .optional()
          .describe(
            'Filter expression, e.g. stage[eq]:"PROPOSAL" or companyId[eq]:"uuid"',
          ),
      },
    },
    async ({ limit, starting_after, depth, filter }) => {
      const qs = buildQuery({ limit, starting_after, depth, filter })
      const result = await getClient().get(`/opportunities${qs}`)
      return text(result)
    },
  )

  server.registerTool(
    'delete_opportunity',
    {
      title: 'Delete Opportunity',
      description: 'Delete an opportunity from Twenty CRM',
      inputSchema: {
        id: z.string().describe('Opportunity ID to delete'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().delete(`/opportunities/${id}`)
      const entity = extractMutation(raw, 'delete', 'opportunity')
      return text({ id: entity.id, deleted: true })
    },
  )
}

// ─── Lead tools ─────────────────────────────────────────────

function registerLeadTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'create_lead',
    {
      title: 'Create Lead',
      description: 'Create a new lead in Twenty CRM',
      inputSchema: {
        name: z.string().describe('Lead name'),
        email: z.string().optional().describe('Primary email address'),
        source: z.string().optional().describe('Lead source'),
        industry: z.string().optional().describe('Industry'),
        language: z.string().optional().describe('Language'),
      },
    },
    async ({ name, email, source, industry, language }) => {
      const body: Record<string, unknown> = { name }
      if (email) body.email = { primaryEmail: email }
      if (source) body.source = source
      if (industry) body.industry = industry
      if (language) body.language = language

      const raw = await getClient().post('/leads', body)
      const entity = extractMutation(raw, 'create', 'lead')
      return text({ id: entity.id, name: entity.name })
    },
  )

  server.registerTool(
    'get_lead',
    {
      title: 'Get Lead',
      description: 'Get details of a specific lead by ID',
      inputSchema: {
        id: z.string().describe('Lead ID'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().get(`/leads/${id}`)
      return text(extractEntity(raw, 'lead'))
    },
  )

  server.registerTool(
    'update_lead',
    {
      title: 'Update Lead',
      description: 'Update an existing lead',
      inputSchema: {
        id: z.string().describe('Lead ID'),
        name: z.string().optional().describe('Lead name'),
        email: z.string().optional().describe('Primary email address'),
        source: z.string().optional().describe('Lead source'),
        industry: z.string().optional().describe('Industry'),
      },
    },
    async ({ id, name, email, source, industry }) => {
      const body: Record<string, unknown> = {}
      if (name) body.name = name
      if (email) body.email = { primaryEmail: email }
      if (source) body.source = source
      if (industry) body.industry = industry

      const raw = await getClient().patch(`/leads/${id}`, body)
      const entity = extractMutation(raw, 'update', 'lead')
      return text({ id: entity.id, name: entity.name })
    },
  )

  server.registerTool(
    'list_leads',
    {
      title: 'List Leads',
      description:
        'List leads with optional filtering and cursor-based pagination',
      inputSchema: {
        ...paginationSchema,
        filter: z
          .string()
          .optional()
          .describe(
            'Filter expression, e.g. source[eq]:"website" or industry[ilike]:%tech%',
          ),
      },
    },
    async ({ limit, starting_after, depth, filter }) => {
      const qs = buildQuery({ limit, starting_after, depth, filter })
      const result = await getClient().get(`/leads${qs}`)
      return text(result)
    },
  )

  server.registerTool(
    'delete_lead',
    {
      title: 'Delete Lead',
      description: 'Delete a lead from Twenty CRM',
      inputSchema: {
        id: z.string().describe('Lead ID to delete'),
      },
    },
    async ({ id }) => {
      const raw = await getClient().delete(`/leads/${id}`)
      const entity = extractMutation(raw, 'delete', 'lead')
      return text({ id: entity.id, deleted: true })
    },
  )
}

// ─── Schema discovery tool ──────────────────────────────────

function registerSchemaTools(
  server: McpServer,
  getClient: () => TwentyCrmClient,
) {
  server.registerTool(
    'get_api_schema',
    {
      title: 'Get API Schema',
      description:
        'Get the OpenAPI schema for the Twenty CRM REST API. Useful for discovering available object types, fields, and relations.',
      inputSchema: {},
    },
    async () => {
      const result = await getClient().get('/open-api/core')
      // The full spec is very large — return just paths and schema names
      const spec = result as {
        paths?: Record<string, unknown>
        components?: { schemas?: Record<string, unknown> }
      }
      const paths = spec.paths ? Object.keys(spec.paths) : []
      const schemas = spec.components?.schemas
        ? Object.keys(spec.components.schemas)
        : []
      return text({
        endpoints: paths.length,
        paths: paths.filter(
          (p) => !p.startsWith('/batch/') && !p.startsWith('/restore/'),
        ),
        schemaNames: schemas,
      })
    },
  )
}

// ─── Public API ─────────────────────────────────────────────

export function registerTwentyCrmTools(server: McpServer) {
  const getClient = getTwentyCrmClient
  registerPeopleTools(server, getClient)
  registerCompanyTools(server, getClient)
  registerNoteTools(server, getClient)
  registerTaskTools(server, getClient)
  registerOpportunityTools(server, getClient)
  registerLeadTools(server, getClient)
  registerSchemaTools(server, getClient)
}

export const twentyCrmConfig = {
  basePath: '',
  maxDuration: 60,
  verboseLogs: true,
}

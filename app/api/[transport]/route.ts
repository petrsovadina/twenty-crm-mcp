/**
 * Standalone MCP route — Twenty CRM via HTTP transport.
 *
 * Exposes /api/mcp (and /api/sse) endpoints. Bearer token auth required.
 * The same tool registration is shared with the stdio entry (server.ts).
 */

import { createMcpHandler } from 'mcp-handler'
import {
  registerTwentyCrmTools,
  twentyCrmConfig,
} from '@/lib/services/twenty-crm/handler'

const handler = createMcpHandler(
  registerTwentyCrmTools,
  { serverInfo: { name: 'twenty-crm', version: '1.0.0' } },
  { ...twentyCrmConfig, basePath: '/api' },
)

async function authedHandler(req: Request): Promise<Response> {
  const expected = process.env.MCP_BEARER_TOKEN
  if (!expected) {
    return new Response('Server misconfigured: MCP_BEARER_TOKEN unset', {
      status: 500,
    })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  return handler(req)
}

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE }

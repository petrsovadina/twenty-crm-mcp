/**
 * Healthcheck — no auth, returns 200 OK if route reachable.
 */

export function GET() {
  return Response.json({
    status: 'ok',
    service: 'twenty-crm-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
}

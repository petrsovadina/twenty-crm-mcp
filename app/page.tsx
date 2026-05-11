export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
        Twenty CRM MCP
      </h1>
      <p style={{ color: '#a3a3a3', marginTop: 0 }}>
        Model Context Protocol server for Twenty CRM. 31 tools across 6
        entities (People, Companies, Notes, Tasks, Opportunities, Leads) plus
        schema discovery.
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Endpoints</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <code>POST /api/mcp</code> — MCP JSON-RPC (Bearer auth required)
          </li>
          <li>
            <code>GET /api/health</code> — health check (no auth)
          </li>
        </ul>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Auth</h2>
        <pre
          style={{
            background: '#171717',
            padding: '1rem',
            borderRadius: 6,
            overflow: 'auto',
          }}
        >
{`Authorization: Bearer <MCP_BEARER_TOKEN>`}
        </pre>
      </section>
    </main>
  )
}

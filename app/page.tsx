import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`
  const mcpUrl = `${origin}/api/mcp`

  const tokenSet = Boolean(process.env.MCP_BEARER_TOKEN)
  const readOnly = process.env.TWENTY_READ_ONLY === 'true'
  const twentySet = Boolean(process.env.TWENTY_API_KEY && process.env.TWENTY_BASE_URL)

  const healthy = tokenSet && twentySet
  const toolCount = readOnly ? 13 : 31

  const stdioConfig = JSON.stringify(
    {
      mcpServers: {
        'twenty-crm': {
          command: 'bun',
          args: ['run', '/absolute/path/to/server.ts'],
          env: {
            TWENTY_API_KEY: '<your-key>',
            TWENTY_BASE_URL: '<your-twenty>/rest',
          },
        },
      },
    },
    null,
    2,
  )

  const httpConfig = JSON.stringify(
    {
      mcpServers: {
        'twenty-crm': {
          url: mcpUrl,
          headers: {
            Authorization: 'Bearer <MCP_BEARER_TOKEN>',
          },
        },
      },
    },
    null,
    2,
  )

  const connectorConfig = JSON.stringify(
    {
      type: 'mcp',
      transport: 'http',
      endpoint: mcpUrl,
      auth: {
        type: 'bearer',
        token: '<MCP_BEARER_TOKEN>',
      },
    },
    null,
    2,
  )

  return (
    <main style={S.main}>
      <header style={S.header}>
        <h1 style={S.h1}>Twenty CRM MCP</h1>
        <div style={S.statusRow}>
          <Dot ok={healthy} />
          <span style={S.statusText}>
            {healthy ? 'operational' : 'degraded — check env vars'}
          </span>
        </div>
      </header>

      <section style={S.section}>
        <h2 style={S.h2}>Status</h2>
        <dl style={S.dl}>
          <Row label="Endpoint" value={<code style={S.inline}>{mcpUrl}</code>} />
          <Row label="Auth" value={<Badge ok={tokenSet}>{tokenSet ? 'Bearer token set' : 'MCP_BEARER_TOKEN unset'}</Badge>} />
          <Row label="Twenty CRM" value={<Badge ok={twentySet}>{twentySet ? 'credentials set' : 'TWENTY_API_KEY / TWENTY_BASE_URL unset'}</Badge>} />
          <Row label="Mode" value={<Badge ok={true} neutral>{readOnly ? 'read-only' : 'full CRUD'}</Badge>} />
          <Row label="Tools" value={<code style={S.inline}>{toolCount} registered</code>} />
        </dl>
      </section>

      <section style={S.section}>
        <h2 style={S.h2}>Connect</h2>
        <p style={S.muted}>Three ways to wire this server into an MCP client.</p>

        <Snippet
          title="1. Stdio (local) — Claude Desktop"
          subtitle="Run on your machine. Best for development."
          code={stdioConfig}
          filename="~/Library/Application Support/Claude/claude_desktop_config.json"
        />

        <Snippet
          title="2. HTTP (remote) — Claude Desktop"
          subtitle="This deployment. Multi-client, no local setup."
          code={httpConfig}
          filename="~/Library/Application Support/Claude/claude_desktop_config.json"
        />

        <Snippet
          title="3. Custom connector (Cursor, in-house agent, etc.)"
          subtitle="Generic MCP connector payload."
          code={connectorConfig}
        />
      </section>

      <section style={S.section}>
        <h2 style={S.h2}>Smoke test</h2>
        <pre style={S.pre}>
{`curl ${origin}/api/health

curl -X POST ${mcpUrl} \\
  -H "Authorization: Bearer <MCP_BEARER_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`}
        </pre>
      </section>

      <footer style={S.footer}>
        <span>v1.0.0</span>
        <span style={S.sep}>·</span>
        <a href="/api/health" style={S.link}>health</a>
        <span style={S.sep}>·</span>
        <a
          href="https://github.com/abugodev/twenty-crm-mcp"
          style={S.link}
          rel="noreferrer"
        >
          source
        </a>
      </footer>
    </main>
  )
}

// ─── primitives ────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={S.row}>
      <dt style={S.dt}>{label}</dt>
      <dd style={S.dd}>{value}</dd>
    </div>
  )
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: ok ? '#22c55e' : '#f59e0b',
        boxShadow: `0 0 0 4px ${ok ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'}`,
      }}
    />
  )
}

function Badge({
  ok,
  neutral,
  children,
}: {
  ok: boolean
  neutral?: boolean
  children: React.ReactNode
}) {
  const color = neutral ? '#a3a3a3' : ok ? '#22c55e' : '#f59e0b'
  return (
    <span
      style={{
        fontSize: 13,
        color,
        fontFamily: S.mono,
      }}
    >
      {children}
    </span>
  )
}

function Snippet({
  title,
  subtitle,
  code,
  filename,
}: {
  title: string
  subtitle: string
  code: string
  filename?: string
}) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={S.h3}>{title}</h3>
      <p style={{ ...S.muted, marginBottom: 8 }}>{subtitle}</p>
      {filename ? (
        <div style={S.filename}>
          <code>{filename}</code>
        </div>
      ) : null}
      <pre style={S.pre}>{code}</pre>
    </div>
  )
}

// ─── styles ────────────────────────────────────────────────────

const mono =
  "'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', ui-monospace, monospace"

const S = {
  mono,
  main: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '3rem 1rem 4rem',
  } as React.CSSProperties,
  header: {
    borderBottom: '1px solid #262626',
    paddingBottom: '1.25rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  h1: {
    fontSize: '1.75rem',
    fontWeight: 600,
    margin: 0,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  h2: {
    fontSize: '0.85rem',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: '#737373',
    marginTop: 0,
    marginBottom: '1rem',
  } as React.CSSProperties,
  h3: {
    fontSize: '0.95rem',
    fontWeight: 500,
    margin: '0 0 0.25rem 0',
    color: '#e5e5e5',
  } as React.CSSProperties,
  statusRow: {
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  statusText: {
    color: '#a3a3a3',
    fontSize: 14,
    fontFamily: mono,
  } as React.CSSProperties,
  section: {
    marginTop: '2.5rem',
  } as React.CSSProperties,
  dl: {
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '0.5rem',
  } as React.CSSProperties,
  row: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    alignItems: 'baseline',
    gap: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #1a1a1a',
  } as React.CSSProperties,
  dt: {
    color: '#737373',
    fontSize: 13,
    margin: 0,
  } as React.CSSProperties,
  dd: {
    margin: 0,
    fontSize: 14,
  } as React.CSSProperties,
  muted: {
    color: '#737373',
    fontSize: 14,
    margin: '0 0 1rem 0',
  } as React.CSSProperties,
  inline: {
    fontFamily: mono,
    fontSize: 13,
    color: '#e5e5e5',
  } as React.CSSProperties,
  filename: {
    fontFamily: mono,
    fontSize: 12,
    color: '#737373',
    padding: '4px 10px',
    background: '#0f0f0f',
    borderRadius: '6px 6px 0 0',
    borderBottom: '1px solid #262626',
    display: 'inline-block',
  } as React.CSSProperties,
  pre: {
    fontFamily: mono,
    fontSize: 13,
    background: '#0f0f0f',
    color: '#e5e5e5',
    padding: '1rem',
    borderRadius: 6,
    overflowX: 'auto' as const,
    border: '1px solid #1f1f1f',
    margin: 0,
    lineHeight: 1.6,
  } as React.CSSProperties,
  footer: {
    marginTop: '3rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid #262626',
    color: '#737373',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  sep: {
    color: '#404040',
  } as React.CSSProperties,
  link: {
    color: '#a3a3a3',
    textDecoration: 'none',
    borderBottom: '1px solid #404040',
  } as React.CSSProperties,
}

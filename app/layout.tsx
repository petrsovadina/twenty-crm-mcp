import type { ReactNode } from 'react'

export const metadata = {
  title: 'Twenty CRM MCP',
  description: 'MCP server for Twenty CRM — REST API gateway with 31 tools',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          margin: 0,
          padding: '2rem',
          background: '#0a0a0a',
          color: '#e5e5e5',
        }}
      >
        {children}
      </body>
    </html>
  )
}

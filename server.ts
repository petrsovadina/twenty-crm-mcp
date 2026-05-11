#!/usr/bin/env bun
/**
 * Standalone Twenty CRM MCP server — stdio transport.
 * For local testing with MCP Inspector or Claude Desktop.
 *
 * Usage:
 *   bun run server.ts
 *
 * Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "twenty-crm": {
 *         "command": "bun",
 *         "args": ["run", "/path/to/server.ts"],
 *         "env": {
 *           "TWENTY_API_KEY": "...",
 *           "TWENTY_BASE_URL": "https://crm.dev.reservio.com/rest"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTwentyCrmTools } from './lib/services/twenty-crm/handler'

const server = new McpServer({
  name: 'twenty-crm',
  version: '1.0.0',
})

registerTwentyCrmTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('Twenty CRM MCP server running on stdio')

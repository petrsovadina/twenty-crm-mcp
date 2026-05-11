import { createMcpHandler } from 'mcp-handler'
import { withV4Auth } from '@/lib/auth/v4-middleware'
import {
  registerTwentyCrmTools,
  twentyCrmConfig,
} from '@/lib/services/twenty-crm/handler'

const handler = createMcpHandler(
  registerTwentyCrmTools,
  { serverInfo: { name: 'twenty-crm', version: '1.0.0' } },
  { ...twentyCrmConfig, basePath: '/api/twenty-crm/v4' },
)

const authenticatedHandler = withV4Auth({ shared: handler })
export { authenticatedHandler as GET, authenticatedHandler as POST }

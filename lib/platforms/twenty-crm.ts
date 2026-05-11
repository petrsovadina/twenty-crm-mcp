/**
 * Twenty CRM REST API client factory.
 *
 * Lazy singleton — created on first call, reused after.
 * Requires TWENTY_API_KEY and TWENTY_BASE_URL.
 *
 * The actual API is at {TWENTY_BASE_URL} which already includes the /rest/ path
 * (e.g. https://crm.dev.reservio.com/rest/).
 * Endpoints are appended directly (e.g. /people, /companies).
 */

export interface TwentyCrmClient {
  get: (endpoint: string) => Promise<unknown>
  post: (endpoint: string, data: unknown) => Promise<unknown>
  patch: (endpoint: string, data: unknown) => Promise<unknown>
  delete: (endpoint: string) => Promise<unknown>
}

let client: TwentyCrmClient | null = null

const RETRY_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504])
const RETRY_BACKOFF_MS: readonly number[] = [200, 800, 2000]

function createClient(apiKey: string, baseUrl: string): TwentyCrmClient {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  async function request(
    endpoint: string,
    method: string,
    data?: unknown,
  ): Promise<unknown> {
    const url = `${normalizedBase}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = { method, headers }

    if (
      data &&
      (method === 'POST' || method === 'PATCH' || method === 'PUT')
    ) {
      options.body = JSON.stringify(data)
    }

    // Retry only idempotent reads. Write ops fail fast — retrying without
    // an Idempotency-Key risks duplicate creates / double updates.
    const retryable = method === 'GET'
    const maxAttempts = retryable ? RETRY_BACKOFF_MS.length + 1 : 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, options)

      if (response.ok) {
        if (response.status === 204) return undefined
        return response.json()
      }

      const isLastAttempt = attempt === maxAttempts - 1
      if (
        !isLastAttempt &&
        retryable &&
        RETRY_STATUSES.has(response.status)
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BACKOFF_MS[attempt]),
        )
        continue
      }

      const errorText = await response.text()
      throw new Error(
        `Twenty CRM API ${method} ${endpoint}: HTTP ${response.status} — ${errorText}`,
      )
    }

    throw new Error(
      `Twenty CRM API ${method} ${endpoint}: exhausted ${maxAttempts} attempts`,
    )
  }

  return {
    get: (endpoint) => request(endpoint, 'GET'),
    post: (endpoint, data) => request(endpoint, 'POST', data),
    patch: (endpoint, data) => request(endpoint, 'PATCH', data),
    delete: (endpoint) => request(endpoint, 'DELETE'),
  }
}

export function getTwentyCrmClient(): TwentyCrmClient {
  if (client) return client

  const apiKey = process.env.TWENTY_API_KEY
  if (!apiKey) {
    throw new Error('TWENTY_API_KEY environment variable is not set')
  }

  const baseUrl = process.env.TWENTY_BASE_URL
  if (!baseUrl) {
    throw new Error('TWENTY_BASE_URL environment variable is not set')
  }

  client = createClient(apiKey, baseUrl)
  return client
}

export function resetTwentyCrmClient(): void {
  client = null
}

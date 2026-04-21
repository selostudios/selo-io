import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

async function loadFresh() {
  vi.resetModules()
  return await import('@/lib/alerts/notify-infra-failure')
}

describe('notifyInfraFailure', () => {
  const originalEnv = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)
    process.env.RESEND_API_KEY = 'test_api_key'
    process.env.RESEND_FROM_EMAIL = 'alerts@selo.io'
    process.env.ALERT_EMAIL = 'owain@selo.io'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('posts to Resend API when all required env vars are present', async () => {
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({
      type: 'missing_env',
      message: 'NEXT_PUBLIC_SUPABASE_URL is undefined',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body.from).toBe('alerts@selo.io')
    expect(body.to).toBe('owain@selo.io')
    expect(body.subject).toContain('missing_env')
    expect(body.text).toContain('NEXT_PUBLIC_SUPABASE_URL is undefined')
  })

  test('skips send when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({ type: 'missing_env', message: 'test' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('skips send when ALERT_EMAIL is missing', async () => {
    delete process.env.ALERT_EMAIL
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({ type: 'missing_env', message: 'test' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('dedupes repeat alerts of the same type within the hour window', async () => {
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({ type: 'middleware_threw', message: 'first' })
    await notifyInfraFailure({ type: 'middleware_threw', message: 'second' })
    await notifyInfraFailure({ type: 'middleware_threw', message: 'third' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('different alert types do not share dedupe window', async () => {
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({ type: 'middleware_threw', message: 'a' })
    await notifyInfraFailure({ type: 'supabase_client_init_failed', message: 'b' })
    await notifyInfraFailure({ type: 'unhandled_server_error', message: 'c' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('clears dedupe entry when Resend returns non-ok so next attempt can retry', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'resend down',
    })
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({ type: 'middleware_threw', message: 'first' })
    await notifyInfraFailure({ type: 'middleware_threw', message: 'second' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('swallows fetch rejections without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const { notifyInfraFailure } = await loadFresh()

    await expect(
      notifyInfraFailure({ type: 'middleware_threw', message: 'first' })
    ).resolves.toBeUndefined()
  })

  test('includes context fields in the email body when provided', async () => {
    const { notifyInfraFailure } = await loadFresh()

    await notifyInfraFailure({
      type: 'middleware_threw',
      message: 'boom',
      context: { pathname: '/dashboard', hasSupabaseUrl: false },
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.text).toContain('pathname')
    expect(body.text).toContain('/dashboard')
    expect(body.text).toContain('hasSupabaseUrl')
  })
})

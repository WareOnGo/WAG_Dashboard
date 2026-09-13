import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prefersPreciseLocation, requestCurrentLocation } from '../currentLocation'

describe('current location lookup', () => {
  let provider, handlers
  const position = { coords: { latitude: 13.02, longitude: 77.64, accuracy: 50 } }

  beforeEach(() => {
    vi.useFakeTimers()
    provider = { getCurrentPosition: vi.fn() }
    handlers = { onSuccess: vi.fn(), onError: vi.fn() }
  })
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

  it('uses a quick lookup with a recent cached fix allowed on desktop', () => {
    requestCurrentLocation(handlers, provider)
    const [success, , options] = provider.getCurrentPosition.mock.calls[0]
    expect(options).toEqual({ enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 })
    success(position)
    vi.advanceTimersByTime(60000)
    expect(handlers.onSuccess).toHaveBeenCalledExactlyOnceWith(position)
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it('requests a fresh high-accuracy fix when precise mode is selected', () => {
    requestCurrentLocation({ ...handlers, precise: true }, provider)
    expect(provider.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
    vi.advanceTimersByTime(11000)
    provider.getCurrentPosition.mock.calls[0][0](position)
    expect(handlers.onSuccess).toHaveBeenCalledExactlyOnceWith(position)
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it.each([1, 2, 3])('reports error %s without a hidden automatic retry', (code) => {
    requestCurrentLocation(handlers, provider)
    provider.getCurrentPosition.mock.calls[0][1]({ code })
    vi.advanceTimersByTime(60000)
    expect(provider.getCurrentPosition).toHaveBeenCalledOnce()
    expect(handlers.onError).toHaveBeenCalledExactlyOnceWith({ code })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([[false, 7000], [true, 13000]])('bounds an unresponsive browser, precise=%s', (precise, deadline) => {
    requestCurrentLocation({ ...handlers, precise }, provider)
    vi.advanceTimersByTime(deadline)
    expect(provider.getCurrentPosition).toHaveBeenCalledOnce()
    expect(handlers.onError).toHaveBeenCalledExactlyOnceWith({ code: 3 })
    provider.getCurrentPosition.mock.calls[0][0](position)
    expect(handlers.onSuccess).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the timer and ignores delayed results', () => {
    const cancel = requestCurrentLocation(handlers, provider)
    cancel()
    vi.advanceTimersByTime(60000)
    const [success, error] = provider.getCurrentPosition.mock.calls[0]
    success(position)
    error({ code: 3 })
    expect(handlers.onSuccess).not.toHaveBeenCalled()
    expect(handlers.onError).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('mobile location defaults', () => {
  it.each([
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 16) Chrome/140 Mobile' }, true],
    [{ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }, true],
    [{ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }, true],
    [{ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/145' }, false],
    [{ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', maxTouchPoints: 10 }, false],
  ])('chooses a location mode for %j', (device, expected) => {
    expect(prefersPreciseLocation(device)).toBe(expected)
  })
})

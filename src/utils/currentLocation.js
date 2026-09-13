// Browsers expose no GPS capability flag. Prefer accuracy on mobile platforms;
// a laptop can still request a precise attempt explicitly.
export function prefersPreciseLocation(device = navigator) {
  return !!device.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(device.userAgent || '') ||
    (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
}

/** One bounded lookup, without automatic retries. */
export function requestCurrentLocation({ onSuccess, onError, precise = false }, geolocation = navigator.geolocation) {
  let active = true
  const options = {
    enableHighAccuracy: precise,
    timeout: precise ? 12000 : 6000,
    maximumAge: precise ? 0 : 30000,
  }

  const finish = (callback, result) => {
    if (!active) return
    active = false
    clearTimeout(timer)
    callback(result)
  }

  // The native timeout can exclude permission prompts. Keep the UI bounded even
  // when a browser/provider delivers no callback, and ignore late responses.
  const timer = setTimeout(() => finish(onError, { code: 3 }), options.timeout + 1000)
  try {
    geolocation.getCurrentPosition(
      position => finish(onSuccess, position),
      error => finish(onError, error),
      options,
    )
  } catch { finish(onError, { code: 2 }) }

  return () => {
    active = false
    clearTimeout(timer)
  }
}

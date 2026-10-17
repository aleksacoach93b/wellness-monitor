/** Coarse device/browser groups only. Never store full UA, model guesses or camera IDs. */
export function measurementEnvironment(ua: string) {
  const platform = /iPhone|iPad|iPod/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Macintosh/i.test(ua)
        ? 'macOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : 'Other'
  const browser = /SamsungBrowser\//i.test(ua)
    ? 'Samsung Internet'
    : /Edg(?:A|iOS)?\//i.test(ua)
      ? 'Edge'
      : /Firefox|FxiOS/i.test(ua)
        ? 'Firefox'
        : /Chrome|CriOS/i.test(ua)
          ? 'Chrome'
          : /Safari/i.test(ua)
            ? 'Safari'
            : 'Other'
  return { platform, browser }
}

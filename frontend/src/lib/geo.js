const toRad = (d) => (d * Math.PI) / 180

/** Great-circle distance in km between two [lat, lng] points. */
export function haversineKm(a, b) {
  const [lat1, lng1] = a
  const [lat2, lng2] = b
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function centroid(points) {
  if (!points.length) return [0, 0]
  const lat = points.reduce((s, p) => s + p[0], 0) / points.length
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length
  return [lat, lng]
}

/**
 * Projects [lat, lng] points into a width×height box (equirectangular with
 * latitude correction) keeping aspect ratio. Returns a function point → [x, y].
 */
export function fitProjection(points, width, height, padding = 24) {
  if (!points.length) return () => [width / 2, height / 2]
  const meanLat = toRad(points.reduce((s, p) => s + p[0], 0) / points.length)
  const kx = Math.cos(meanLat)
  const xs = points.map((p) => p[1] * kx)
  const ys = points.map((p) => -p[0])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 0.004)
  const spanY = Math.max(maxY - minY, 0.004)
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
  const offX = (width - spanX * scale) / 2
  const offY = (height - spanY * scale) / 2
  return (p) => [offX + (p[1] * kx - minX) * scale, offY + (-p[0] - minY) * scale]
}

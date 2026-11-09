// Packing & prep checklist, generated from the forecast and the plan itself.

export function buildChecklist(trip, dest, { weather = [], schedules = [] } = {}) {
  const highs = weather.map((w) => w.high)
  const lows = weather.map((w) => w.low)
  const maxHigh = highs.length ? Math.max(...highs) : dest.climate[0].high
  const minLow = lows.length ? Math.min(...lows) : dest.climate[0].low
  const rainyDays = weather.filter((w) => w.condition === 'rain' || w.condition === 'storm').length
  const snowy = weather.some((w) => w.condition === 'snow')
  const sunny = weather.filter((w) => w.condition === 'sunny').length
  const stops = schedules.flatMap((s) => s.stops)
  const has = (pred) => stops.some((s) => pred(s.act))
  const avgWalk = schedules.length ? schedules.reduce((m, s) => m + s.stats.walkKm, 0) / schedules.length : 0
  const bookAhead = stops.filter((s) => s.act.tags.includes('booking-advised'))

  const groups = [
    {
      key: 'docs',
      label: 'Documents',
      emoji: '🛂',
      items: [
        { key: 'passport', label: 'Passport (valid 6+ months after you return)', emoji: '🛂' },
        { key: 'visa', label: 'Entry requirements for your passport — check the official government site', emoji: '📋' },
        { key: 'insurance', label: 'Travel insurance details', emoji: '🩺' },
        { key: 'boarding', label: 'Boarding passes saved offline', emoji: '🎫' },
      ],
    },
    {
      key: 'clothes',
      label: 'Clothes',
      emoji: '👕',
      items: [
        avgWalk > 2.5 && { key: 'shoes', label: `Comfortable walking shoes — about ${avgWalk.toFixed(1)} km of walking a day`, emoji: '👟' },
        minLow <= 12 && { key: 'layers', label: `Warm layers for evenings down to ${minLow}°C`, emoji: '🧥' },
        minLow <= 2 && { key: 'thermals', label: 'Thermals, hat and gloves', emoji: '🧤' },
        (rainyDays > 0 || snowy) && { key: 'rain', label: `Rain jacket or compact umbrella (${rainyDays || 1} wet day${rainyDays === 1 ? '' : 's'} likely)`, emoji: '☔' },
        maxHigh >= 24 && { key: 'light', label: 'Light, breathable clothes', emoji: '🩳' },
        (dest.vibes.includes('beach') || has((a) => a.category === 'relax' && /beach|bath|lagoon|pool|spa|hammam/i.test(`${a.name} ${a.type}`))) && { key: 'swim', label: 'Swimsuit', emoji: '🩱' },
        has((a) => a.category === 'nature' || a.dayTrip) && { key: 'daypack', label: 'Day pack and refillable water bottle', emoji: '🎒' },
      ].filter(Boolean),
    },
    {
      key: 'health',
      label: 'Health & comfort',
      emoji: '🧴',
      items: [
        (sunny >= 1 && maxHigh >= 18) && { key: 'sunscreen', label: 'Sunscreen and sunglasses', emoji: '🧴' },
        { key: 'meds', label: 'Any regular medication (in your carry-on)', emoji: '💊' },
        { key: 'water', label: dest.practical.water, emoji: '💧' },
      ].filter(Boolean),
    },
    {
      key: 'tech',
      label: 'Tech',
      emoji: '🔌',
      items: [
        { key: 'adapter', label: `Plug adapter — ${dest.practical.plug}`, emoji: '🔌' },
        { key: 'powerbank', label: 'Power bank for long sightseeing days', emoji: '🔋' },
        { key: 'offline', label: `Offline map of ${dest.name}`, emoji: '🗺️' },
      ],
    },
    {
      key: 'prep',
      label: 'Before you go',
      emoji: '✅',
      items: [
        ...bookAhead.slice(0, 5).map((s) => ({ key: `book-${s.act.id}`, label: `Book ahead: ${s.act.name}`, emoji: '🎟️' })),
        { key: 'bank', label: `Tell your bank you're travelling (local currency: ${dest.currency.code})`, emoji: '💳' },
        { key: 'emergency', label: `Save the local emergency number: ${dest.practical.emergency}`, emoji: '🚨' },
        { key: 'tipping', label: `Tipping: ${dest.practical.tipping}`, emoji: '🪙' },
      ],
    },
  ]
  return groups.filter((g) => g.items.length)
}

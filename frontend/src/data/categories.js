// Shared vocabularies for the whole app. Every label has an emoji AND text so the
// "Emoji / Text / Both" accessibility setting can switch between them anywhere.

export const CATEGORIES = {
  sightseeing: { label: 'Sightseeing', emoji: '📸' },
  culture: { label: 'Culture', emoji: '🏛️' },
  food: { label: 'Food', emoji: '🍽️' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  nature: { label: 'Nature', emoji: '🌿' },
  nightlife: { label: 'Nightlife', emoji: '🌙' },
  relax: { label: 'Relax', emoji: '🧖' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES)

export const MEALS = {
  breakfast: { label: 'Breakfast', emoji: '🥐', window: [7.5, 10.5] },
  lunch: { label: 'Lunch', emoji: '🥗', window: [11.5, 14.5] },
  dinner: { label: 'Dinner', emoji: '🍝', window: [18, 21.5] },
  snack: { label: 'Snack', emoji: '🍦', window: [14.5, 18] },
}

export const MEAL_KEYS = Object.keys(MEALS)

export const TRANSPORT_MODES = {
  walk: { label: 'Walk', emoji: '🚶' },
  transit: { label: 'Transit', emoji: '🚇' },
  taxi: { label: 'Taxi', emoji: '🚕' },
  tour: { label: 'Day-trip transport', emoji: '🚌' },
  flight: { label: 'Flight', emoji: '✈️' },
}

// Colour token for each budget line, shared by the donut, legends and per-day bars.
export const BUDGET_COLORS = {
  flights: 'var(--cat-flight)',
  stay: 'var(--cat-stay)',
  food: 'var(--cat-food)',
  activities: 'var(--cat-culture)',
  transport: 'var(--cat-transport)',
  extras: 'var(--cat-shopping)',
}

export const VIBES = {
  warm: { label: 'Warm', emoji: '☀️' },
  cold: { label: 'Crisp & cold', emoji: '❄️' },
  beach: { label: 'Beach', emoji: '🏖️' },
  mountains: { label: 'Mountains', emoji: '🏔️' },
  city: { label: 'Big city', emoji: '🏙️' },
  scenic: { label: 'Scenic', emoji: '🌄' },
  food: { label: 'Food scene', emoji: '🍜' },
  culture: { label: 'Culture', emoji: '🎭' },
  nightlife: { label: 'Nightlife', emoji: '🪩' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  adventure: { label: 'Adventure', emoji: '🧗' },
  romantic: { label: 'Romantic', emoji: '💞' },
  family: { label: 'Family', emoji: '🧸' },
  budget: { label: 'Budget-friendly', emoji: '💸' },
  luxury: { label: 'Treat yourself', emoji: '💎' },
  offbeat: { label: 'Somewhere new', emoji: '🧭' },
}

export const VIBE_KEYS = Object.keys(VIBES)

export const TAGS = {
  iconic: 'Iconic',
  free: 'Free',
  outdoor: 'Outdoor',
  indoor: 'Indoor',
  'rainy-day': 'Rainy-day pick',
  'step-free': 'Step-free access',
  family: 'Family-friendly',
  romantic: 'Romantic',
  views: 'Great views',
  'local-favorite': 'Local favourite',
  'hidden-gem': 'Hidden gem',
  vegetarian: 'Veggie-friendly',
  'late-night': 'Open late',
  'booking-advised': 'Book ahead',
}

export const TAG_KEYS = Object.keys(TAGS)

export const REGIONS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'Middle East']

export const POSTER_SCENES = ['coast', 'city', 'mountains', 'desert', 'tropical', 'domes', 'temple']

export const BEST_TIMES = ['morning', 'afternoon', 'evening', 'any']

export const WEATHER = {
  sunny: { label: 'Sunny', emoji: '☀️' },
  partly: { label: 'Partly cloudy', emoji: '⛅' },
  cloudy: { label: 'Cloudy', emoji: '☁️' },
  rain: { label: 'Showers', emoji: '🌧️' },
  storm: { label: 'Storms', emoji: '⛈️' },
  snow: { label: 'Snow', emoji: '❄️' },
}

export const INTERESTS = ['sightseeing', 'food', 'shopping', 'culture', 'nature', 'nightlife', 'relax']

export const PACES = {
  // activeMin = target minutes of sights/activities per full day (meals not included).
  relaxed: { label: 'Relaxed', emoji: '🐢', blurb: '2–3 things a day, long lunches', start: 9.5, end: 21.5, activeMin: 230, maxMains: 3 },
  balanced: { label: 'Balanced', emoji: '🚶', blurb: '3–5 things a day, room to wander', start: 9, end: 22.75, activeMin: 320, maxMains: 5 },
  packed: { label: 'Packed', emoji: '⚡', blurb: 'See it all — early starts, late nights', start: 8, end: 24, activeMin: 450, maxMains: 7 },
}

export const AMENITIES = {
  wifi: { label: 'Wi-Fi', emoji: '📶' },
  kitchen: { label: 'Kitchen', emoji: '🍳' },
  ac: { label: 'Air conditioning', emoji: '❄️' },
  washer: { label: 'Washer', emoji: '🧺' },
  workspace: { label: 'Workspace', emoji: '💻' },
  pool: { label: 'Pool', emoji: '🏊' },
  parking: { label: 'Free parking', emoji: '🅿️' },
  breakfast: { label: 'Breakfast included', emoji: '🥐' },
  balcony: { label: 'Balcony', emoji: '🌇' },
  'step-free': { label: 'Step-free entry', emoji: '♿' },
  heating: { label: 'Heating', emoji: '🔥' },
  gym: { label: 'Gym', emoji: '🏋️' },
}

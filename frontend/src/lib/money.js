// All prices in the app are stored in USD and converted only for display.
// Rates are fixed mock values — good enough for planning, not for paying.
export const CURRENCIES = {
  USD: { label: 'US dollar', rate: 1 },
  CAD: { label: 'Canadian dollar', rate: 1.38 },
  EUR: { label: 'Euro', rate: 0.92 },
  GBP: { label: 'British pound', rate: 0.79 },
  AUD: { label: 'Australian dollar', rate: 1.52 },
  JPY: { label: 'Japanese yen', rate: 150 },
  MXN: { label: 'Mexican peso', rate: 18.5 },
  INR: { label: 'Indian rupee', rate: 84 },
  PKR: { label: 'Pakistani rupee', rate: 280 },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES)

const formatters = new Map()
function formatter(currency, compact) {
  const key = `${currency}|${compact}`
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
        notation: compact ? 'compact' : 'standard',
      }),
    )
  }
  return formatters.get(key)
}

export function fromUSD(usd, currency = 'USD') {
  return usd * (CURRENCIES[currency]?.rate ?? 1)
}

export function toUSD(amount, currency = 'USD') {
  return amount / (CURRENCIES[currency]?.rate ?? 1)
}

export function formatMoney(usd, currency = 'USD', { compact = false } = {}) {
  const value = fromUSD(usd, currency)
  return formatter(currency, compact && Math.abs(value) >= 10000).format(Math.round(value))
}

/** Rounds a USD amount to a "nice" value in the target currency (for slider steps). */
export function niceStep(currency) {
  const rate = CURRENCIES[currency]?.rate ?? 1
  if (rate >= 100) return 10000
  if (rate >= 10) return 1000
  return 50
}

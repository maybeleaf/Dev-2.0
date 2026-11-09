import { useMemo } from 'react'
import { useSettings } from '../context/SettingsContext.jsx'
import { formatMoney } from '../lib/money.js'
import { formatDate, formatDuration, formatDurationShort, formatEpochDate, formatTime, hoursLabel } from '../lib/time.js'

/** Formatters bound to the user's currency and 12/24-hour preference. */
export function useFormat() {
  const { settings } = useSettings()
  const { currency, hour12 } = settings
  return useMemo(
    () => ({
      currency,
      hour12,
      money: (usd, opts) => formatMoney(usd, currency, opts),
      time: (epoch, tz) => formatTime(epoch, tz, hour12),
      date: formatDate,
      epochDate: formatEpochDate,
      duration: formatDuration,
      durationShort: formatDurationShort,
      hours: (h) => hoursLabel(h, hour12),
    }),
    [currency, hour12],
  )
}

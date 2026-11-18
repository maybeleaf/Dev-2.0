import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Lift Off` : 'Lift Off — vacation planning without the hassle'
  }, [title])
}

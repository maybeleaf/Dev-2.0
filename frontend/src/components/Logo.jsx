import { useId } from 'react'

export function LogoMark({ size = 36 }) {
  const clip = `lo${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <rect width="40" height="40" rx="11" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="40" height="40" fill="var(--accent)" />
        <circle cx="20" cy="29" r="10" fill="var(--logo-sun, #ffd9a8)" />
        <rect y="29" width="40" height="11" fill="var(--logo-ground, #7a2a12)" opacity="0.32" />
        <path d="M4 29.5h32" stroke="var(--on-accent)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 24c6-1.5 12-5 19-12.5" stroke="var(--on-accent)" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="0.1 3.4" fill="none" />
        <path d="M24.2 8.6 34 5.2l-3.6 9.6-2.6-3.5-3.9 2.5 1.6-3.6Z" fill="var(--on-accent)" />
      </g>
    </svg>
  )
}

export function Logo({ size = 36 }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">
        Lift <em>Off</em>
      </span>
    </span>
  )
}

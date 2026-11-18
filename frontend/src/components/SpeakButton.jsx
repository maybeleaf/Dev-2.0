import { useId } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { useSpeech } from '../hooks/useSpeech.js'

/** Reads `text` (a string or a function returning one) aloud. Hidden when TTS is off or unsupported. */
export function SpeakButton({ text, label = 'Read aloud', className = 'btn btn-secondary btn-sm', iconOnly = false }) {
  const owner = useId()
  const { speak, stop, speaking, enabled } = useSpeech(owner)
  if (!enabled) return null
  const onClick = () => {
    if (speaking) stop()
    else speak(typeof text === 'function' ? text() : text)
  }
  return (
    <button type="button" className={`${className} ${iconOnly ? 'btn-icon' : ''}`} onClick={onClick} aria-pressed={speaking} aria-label={iconOnly ? (speaking ? 'Stop reading' : label) : undefined}>
      {speaking ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      {!iconOnly && <span>{speaking ? 'Stop' : label}</span>}
    </button>
  )
}

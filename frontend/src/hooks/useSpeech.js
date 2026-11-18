import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext.jsx'
import { getVoices, speak as speakText, stopSpeaking, ttsSupported } from '../lib/speech.js'

let activeOwner = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn(activeOwner))

/** Read-aloud bound to the user's voice + rate. Only one thing speaks at a time. */
export function useSpeech(owner) {
  const { settings } = useSettings()
  const [current, setCurrent] = useState(activeOwner)
  useEffect(() => {
    listeners.add(setCurrent)
    return () => listeners.delete(setCurrent)
  }, [])

  const supported = ttsSupported()
  const enabled = supported && settings.tts

  const speak = useCallback(
    (text, who = owner) => {
      if (!enabled) return false
      activeOwner = who ?? 'anon'
      notify()
      return speakText(text, {
        rate: settings.ttsRate,
        voiceURI: settings.ttsVoice,
        onEnd: () => {
          if (activeOwner === (who ?? 'anon')) {
            activeOwner = null
            notify()
          }
        },
      })
    },
    [enabled, owner, settings.ttsRate, settings.ttsVoice],
  )

  const stop = useCallback(() => {
    stopSpeaking()
    activeOwner = null
    notify()
  }, [])

  return { speak, stop, supported, enabled, speaking: owner ? current === owner : current !== null }
}

/** Voices load asynchronously in most browsers. */
export function useVoices() {
  const [voices, setVoices] = useState(getVoices)
  useEffect(() => {
    if (!ttsSupported()) return undefined
    const on = () => setVoices(getVoices())
    window.speechSynthesis.addEventListener?.('voiceschanged', on)
    const t = setTimeout(on, 400)
    return () => {
      clearTimeout(t)
      window.speechSynthesis.removeEventListener?.('voiceschanged', on)
    }
  }, [])
  return voices
}

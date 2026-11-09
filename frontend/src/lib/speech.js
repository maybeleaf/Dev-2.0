// Text-to-speech via the Web Speech API (built into every modern browser).
// Long text is split into sentences because Chrome cuts off long utterances.

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

let token = 0

export function speak(text, { rate = 1, voiceURI, onEnd } = {}) {
  if (!ttsSupported() || !text) return false
  const synth = window.speechSynthesis
  synth.cancel()
  const my = ++token
  const voice = voiceURI ? synth.getVoices().find((v) => v.voiceURI === voiceURI) : null
  const chunks = String(text)
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]*\s*/g) || [text]
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk.trim())
    u.rate = rate
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    }
    if (i === chunks.length - 1) {
      u.onend = () => my === token && onEnd?.()
      u.onerror = () => my === token && onEnd?.()
    }
    synth.speak(u)
  })
  return true
}

export function stopSpeaking() {
  token++
  if (ttsSupported()) window.speechSynthesis.cancel()
}

export function getVoices() {
  if (!ttsSupported()) return []
  return window.speechSynthesis.getVoices()
}

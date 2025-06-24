import { useState, useRef, useCallback } from 'react'

interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
}

export function useOpenAITTS() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCache = useRef<Map<string, string>>(new Map())

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    if (!text.trim()) return

    try {
      setError(null)
      setIsLoading(true)

      // Create cache key
      const cacheKey = `${text}_${options.voice || 'nova'}`
      
      // Check if audio is cached
      let audioUrl = audioCache.current.get(cacheKey)
      
      if (!audioUrl) {
        // Generate new audio
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice: options.voice || 'nova'
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate speech')
        }

        // Create blob URL from audio data
        const audioBlob = await response.blob()
        audioUrl = URL.createObjectURL(audioBlob)
        
        // Cache the audio URL
        audioCache.current.set(cacheKey, audioUrl)
      }

      setIsLoading(false)
      
      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }

      // Create and play new audio
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onloadstart = () => {
        setIsSpeaking(true)
        options.onStart?.()
      }

      audio.onended = () => {
        setIsSpeaking(false)
        options.onEnd?.()
      }

      audio.onerror = () => {
        setIsSpeaking(false)
        const audioError = new Error('Audio playback failed')
        setError(audioError.message)
        options.onError?.(audioError)
      }

      await audio.play()

    } catch (err) {
      setIsLoading(false)
      setIsSpeaking(false)
      const error = err instanceof Error ? err : new Error('Unknown TTS error')
      setError(error.message)
      options.onError?.(error)
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsSpeaking(false)
    }
  }, [])

  const cleanup = useCallback(() => {
    stop()
    // Clean up blob URLs to prevent memory leaks
    audioCache.current.forEach(url => URL.revokeObjectURL(url))
    audioCache.current.clear()
  }, [stop])

  return {
    speak,
    stop,
    cleanup,
    isLoading,
    isSpeaking,
    error
  }
} 
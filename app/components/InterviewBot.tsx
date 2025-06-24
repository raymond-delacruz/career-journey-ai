'use client'

import { useState, useEffect, useRef } from 'react'
import { Room, AudioTrack, createLocalAudioTrack, Track } from 'livekit-client'
import { useOpenAITTS } from '../../hooks/useOpenAITTS'

const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

interface Question {
  id: number
  text: string
  category: string
  context?: string // Optional context field that won't be displayed
}

interface InterviewBotProps {
  room: Room | null
  currentQuestion: Question
  isConnected: boolean
  isInterviewStarted: boolean
  onBotDoneSpeaking: () => void
  onBotStartedSpeaking: () => void
}

export function InterviewBot({ room, currentQuestion, isConnected, isInterviewStarted, onBotDoneSpeaking, onBotStartedSpeaking }: InterviewBotProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova')
  const [error, setError] = useState<string | null>(null)
  const [hasSpokenCurrentQuestion, setHasSpokenCurrentQuestion] = useState(false)
  const hasAttemptedConnection = useRef(false)
  const lastSpokenQuestionId = useRef<number | null>(null)
  const lastQuestionId = useRef<number | null>(null)
  
  const { speak, stop, cleanup } = useOpenAITTS()

  // Randomly select a voice on component mount
  useEffect(() => {
    const randomVoice = voices[Math.floor(Math.random() * voices.length)];
    setSelectedVoice(randomVoice);
  }, []);

  useEffect(() => {
    if (isConnected && room && !hasAttemptedConnection.current) {
      hasAttemptedConnection.current = true
      initializeAudioTrack()
    }
  }, [isConnected, room])

  useEffect(() => {
    // Auto-speak new questions when interview is started and bot is not currently speaking
    if (
      isInterviewStarted && 
      currentQuestion && 
      currentQuestion.id !== lastSpokenQuestionId.current &&
      !isSpeaking &&
      !isLoading
    ) {
      console.log('🎯 New question detected, speaking:', currentQuestion.text)
      lastSpokenQuestionId.current = currentQuestion.id
      speakQuestion(currentQuestion.text)
    }
  }, [currentQuestion.id, isInterviewStarted, isSpeaking, isLoading])

  useEffect(() => {
    // Cleanup function
    return () => {
      if (audioTrack) {
        audioTrack.stop()
      }
      if (audioContext) {
        audioContext.close()
      }
      cleanup() // Clean up OpenAI TTS resources
    }
  }, [cleanup])

  const initializeAudioTrack = async () => {
    try {
      console.log('Initializing audio track for LiveKit broadcasting...')
      
      // Create audio context for broadcasting
      const context = new AudioContext()
      setAudioContext(context)
      
      // Create a local audio track for broadcasting our TTS
      const track = await createLocalAudioTrack({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      })
      
      setAudioTrack(track)
      
      // Publish the track to the room
      if (room) {
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.Microphone,
          name: 'interview-bot-audio'
        })
        console.log('Audio track published successfully')
        setConnectionStatus('connected')
      }
    } catch (error) {
      console.error('Error initializing audio track:', error)
      setConnectionStatus('error')
    }
  }

  const speakQuestion = async (text: string) => {
    console.log('🚀 Starting OpenAI TTS speech for:', text.substring(0, 50) + '...')
    
    setIsLoading(true)
    setError(null)
    
    // Add natural conversation flow
    const enhancedText = addNaturalConversationFlow(text)
    
    await speak(enhancedText, {
      voice: selectedVoice,
      onStart: () => {
        console.log('🎙️ OpenAI TTS started speaking')
        setIsLoading(false)
        setIsSpeaking(true)
        onBotStartedSpeaking()
      },
      onEnd: () => {
        console.log('🎙️ OpenAI TTS finished speaking')
        setIsSpeaking(false)
        onBotDoneSpeaking()
      },
      onError: (error) => {
        console.error('🚨 OpenAI TTS error:', error)
        setIsLoading(false)
        setIsSpeaking(false)
        setError(error.toString())
        onBotDoneSpeaking()
      }
    })
  }

  const addNaturalConversationFlow = (text: string) => {
    // Add natural pauses and conversation markers
    let enhancedText = text
    
    // Add a natural greeting for the first question
    if (text.toLowerCase().includes('tell me about yourself')) {
      enhancedText = `Great! Let's get started. ${text}`
    } else if (text.toLowerCase().includes('why are you')) {
      enhancedText = `Okay, next question. ${text}`
    } else if (text.toLowerCase().includes('walk me through')) {
      enhancedText = `Perfect. Now, ${text.toLowerCase()}`
    } else if (text.toLowerCase().includes('describe')) {
      enhancedText = `Alright. ${text}`
    } else if (text.toLowerCase().includes('how do you')) {
      enhancedText = `Good. ${text}`
    } else if (text.toLowerCase().includes('what')) {
      enhancedText = `Let me ask you this: ${text.toLowerCase()}`
    }
    
    // Add natural pauses for complex sentences
    enhancedText = enhancedText
      .replace(/\. /g, '. ')
      .replace(/\? /g, '? ')
      .replace(/\, /g, ', ')
    
    return enhancedText
  }

  const stopSpeaking = () => {
    console.log('🛑 Stopping OpenAI TTS speech')
    stop()
    setIsSpeaking(false)
    setIsLoading(false)
    onBotDoneSpeaking()
  }

  const getStatusColor = () => {
    if (error) return 'text-red-500'
    if (isLoading) return 'text-yellow-500'
    if (isSpeaking) return 'text-green-500'
    switch (connectionStatus) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'error': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getVoiceDisplayName = (voice: string) => {
    const voiceMap: Record<string, string> = {
      'nova': 'Nova (Warm Female)',
      'shimmer': 'Shimmer (Soft Female)',
      'alloy': 'Alloy (Neutral)',
      'echo': 'Echo (Clear Male)',
      'fable': 'Fable (Expressive)',
      'onyx': 'Onyx (Deep Male)'
    };
    return voiceMap[voice] || voice;
  };

  const getStatusText = () => {
    if (error) return `Error: ${error}`
    if (isLoading) return 'Generating speech...'
    if (isSpeaking) return 'Speaking...'
    switch (connectionStatus) {
      case 'connected': return 'OpenAI TTS Ready'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Connection Error'
      default: return 'Disconnected'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <h3 className="text-lg font-semibold text-gray-800">AI Interview Coach</h3>
        </div>
      </div>

      {/* Current Question Display */}
      {currentQuestion && (
        <div className="mb-6">
          <p className="text-lg text-gray-700 leading-relaxed">
            {currentQuestion.text}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span>Generating high-quality speech...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              Failed to generate speech. Ensure your OpenAI API key is configured correctly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
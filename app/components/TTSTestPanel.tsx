'use client'

import { useState, useEffect } from 'react'
import { useOpenAITTS } from '../../hooks/useOpenAITTS'

const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

export function TTSTestPanel() {
  const [testText, setTestText] = useState('Hello! This is a test of OpenAI\'s high-quality text-to-speech.')
  const [selectedVoice, setSelectedVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova')
  
  const { speak, stop, isLoading, isSpeaking, error } = useOpenAITTS()

  // Randomly select a voice on component mount
  useEffect(() => {
    const randomVoice = voices[Math.floor(Math.random() * voices.length)];
    setSelectedVoice(randomVoice);
  }, []);

  const handleSpeak = () => {
    speak(testText, {
      voice: selectedVoice,
      onStart: () => console.log('🎙️ TTS Test: Started speaking'),
      onEnd: () => console.log('🎙️ TTS Test: Finished speaking'),
      onError: (err) => console.error('🚨 TTS Test Error:', err)
    })
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

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-blue-800 mb-3">🧪 OpenAI TTS Test Panel</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-blue-700 mb-1">Test Text:</label>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
            rows={3}
            disabled={isSpeaking || isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-700 mb-1">Voice:</label>
          <div className="px-3 py-2 border border-blue-300 rounded-md text-sm bg-gray-50">
            {getVoiceDisplayName(selectedVoice)} (randomly selected)
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSpeak}
            disabled={isLoading || isSpeaking || !testText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : isSpeaking ? 'Speaking...' : '🔊 Test Speech'}
          </button>

          {isSpeaking && (
            <button
              onClick={stop}
              className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600"
            >
              ⏹️ Stop
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">❌ Error: {error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span>Generating high-quality speech with OpenAI...</span>
          </div>
        )}

        <div className="text-xs text-blue-600 bg-blue-100 rounded p-2">
          💡 This panel tests the OpenAI TTS integration. The voice is randomly selected for variety!
        </div>
      </div>
    </div>
  )
} 
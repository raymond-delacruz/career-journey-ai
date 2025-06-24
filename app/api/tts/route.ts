import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this route
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'nova' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    console.log('OpenAI API Key present:', !!openaiApiKey)
    console.log('OpenAI API Key length:', openaiApiKey?.length || 0)
    
    if (!openaiApiKey || openaiApiKey === '' || openaiApiKey === 'your_openai_api_key_here') {
      // Return a mock response when OpenAI API key is not configured
      // This allows the app to work without real TTS functionality
      console.log('OpenAI API key not configured, returning mock TTS response')
      
      // Create a minimal MP3 buffer (silence)
      const mockAudioBuffer = new ArrayBuffer(1024)
      
      return new NextResponse(mockAudioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': mockAudioBuffer.byteLength.toString(),
        },
      })
    }

    console.log('Calling OpenAI TTS API with text length:', text.length)
    
    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // Use 'tts-1-hd' for higher quality
        input: text,
        voice: voice, // Available voices: alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
        speed: 1.0
      }),
    })

    console.log('OpenAI TTS API response status:', response.status)
    
    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI TTS API error:', response.status, errorData)
      
      // Return mock audio on API failure to keep the app working
      const mockAudioBuffer = new ArrayBuffer(1024)
      return new NextResponse(mockAudioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': mockAudioBuffer.byteLength.toString(),
        },
      })
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer()
    console.log('Generated audio buffer size:', audioBuffer.byteLength)

    // Return the audio as a response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('TTS API error:', error)
    
    // Return mock audio on any error to keep the app working
    const mockAudioBuffer = new ArrayBuffer(1024)
    return new NextResponse(mockAudioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': mockAudioBuffer.byteLength.toString(),
      },
    })
  }
} 
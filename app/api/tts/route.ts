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
    if (!openaiApiKey || openaiApiKey === '') {
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

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI TTS API error:', errorData)
      return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 })
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer()

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 
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
      // Return a JSON response indicating no TTS available instead of mock audio
      console.log('OpenAI API key not configured, returning no-TTS response')
      
      return NextResponse.json({ 
        error: 'TTS_NOT_CONFIGURED',
        message: 'OpenAI TTS is not configured. Please set OPENAI_API_KEY environment variable.',
        fallback: true
      }, { status: 200 })
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
      
      // Return JSON error instead of mock audio
      return NextResponse.json({
        error: 'TTS_API_ERROR',
        message: 'OpenAI TTS API failed',
        details: errorData,
        fallback: true
      }, { status: 200 })
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer()
    console.log('Generated audio buffer size:', audioBuffer.byteLength)

    // Return the audio as a response
    return new NextResponse(audioBuffer, {
      status: 200,
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
    
    // Return JSON error instead of mock audio
    return NextResponse.json({
      error: 'TTS_INTERNAL_ERROR',
      message: 'Internal TTS error occurred',
      details: error instanceof Error ? error.message : 'Unknown error',
      fallback: true
    }, { status: 200 })
  }
} 
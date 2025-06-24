import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    
    return NextResponse.json({
      openai_key_present: !!openaiKey,
      openai_key_length: openaiKey?.length || 0,
      openai_key_prefix: openaiKey?.substring(0, 20) || 'none',
      openai_key_suffix: openaiKey?.substring(-20) || 'none',
      all_env_keys: Object.keys(process.env).filter(key => 
        key.includes('OPENAI') || key.includes('SUPABASE') || key.includes('LIVEKIT')
      ).sort()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to read environment variables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
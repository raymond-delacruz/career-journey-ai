import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const identity = searchParams.get('identity') || `user-${Date.now()}`
    const room = searchParams.get('room') || 'interview-room'

    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey'
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret'

    if (!apiKey || !apiSecret) {
      console.error('LiveKit credentials missing:', { apiKey: !!apiKey, apiSecret: !!apiSecret })
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      )
    }

    console.log('Generating token with:', { apiKey, identity, room })

    // Create AccessToken with proper configuration
    const at = new AccessToken(apiKey, apiSecret, { 
      identity,
      ttl: '10m' // 10 minutes
    })
    
    // Add grants for the room
    at.addGrant({ 
      roomJoin: true, 
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true
    })

    // Generate the JWT token
    const token = await at.toJwt()
    
    console.log('Generated token:', { tokenLength: token?.length, hasToken: !!token })

    if (!token || typeof token !== 'string') {
      throw new Error('Failed to generate JWT token')
    }

    return NextResponse.json({ 
      token,
      identity,
      room 
    })
  } catch (error) {
    console.error('Error generating LiveKit token:', error)
    return NextResponse.json(
      { error: 'Failed to generate token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 
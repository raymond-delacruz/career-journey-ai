export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

interface FeedbackRequest {
  feedback: string
  userEmail?: string
  page: string
  userAgent: string
  timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    const { feedback, userEmail, page, userAgent, timestamp }: FeedbackRequest = await request.json()

    if (!feedback || feedback.trim().length === 0) {
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      )
    }

    // Save feedback to Supabase database - using camelCase to match Prisma schema
    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .insert([
        {
          feedbackText: feedback.trim(),
          userEmail: userEmail || null,
          page,
          userAgent,
          timestamp: new Date(timestamp)
        }
      ])
      .select()

    if (error) {
      console.error('Database error saving feedback:', error)
      return NextResponse.json(
        { error: 'Failed to save feedback to database' },
        { status: 500 }
      )
    }

    // Log successful save
    console.log('📝 Feedback saved to database:', {
      id: data[0]?.id,
      feedback: feedback.trim().substring(0, 100) + '...',
      userEmail: userEmail || 'Anonymous',
      page,
      timestamp
    })

    return NextResponse.json(
      { 
        success: true, 
        message: 'Feedback submitted successfully',
        id: data[0]?.id
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error processing feedback:', error)
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    )
  }
} 
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

    console.log('🔍 Feedback submission received:', {
      feedback: feedback?.substring(0, 50) + '...',
      userEmail: userEmail || 'none',
      page,
      userAgent: userAgent?.substring(0, 50) + '...',
      timestamp
    })

    if (!feedback || feedback.trim().length === 0) {
      console.log('❌ Validation failed: Empty feedback')
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      )
    }

    // Test database connection first
    console.log('🔗 Testing Supabase connection...')
    const { data: testData, error: testError } = await supabaseAdmin
      .from('feedbacks')
      .select('id')
      .limit(1)

    if (testError) {
      console.error('❌ Supabase connection test failed:', testError)
      return NextResponse.json(
        { error: 'Database connection failed', details: testError },
        { status: 500 }
      )
    }

    console.log('✅ Supabase connection test passed')

    // Prepare the data for insertion
    const insertData = {
      feedbackText: feedback.trim(),
      userEmail: userEmail || null,
      page,
      userAgent,
      timestamp: new Date(timestamp)
    }

    console.log('📝 Attempting to insert:', insertData)

    // Save feedback to Supabase database - using camelCase to match Prisma schema
    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .insert([insertData])
      .select()

    if (error) {
      console.error('❌ Database error saving feedback:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: 'Failed to save feedback to database', details: error },
        { status: 500 }
      )
    }

    // Log successful save
    console.log('✅ Feedback saved to database successfully:', {
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
    console.error('💥 Unexpected error processing feedback:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to process feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 
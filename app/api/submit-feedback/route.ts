export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

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

    // Here you can:
    // 1. Save to database
    // 2. Send email notification
    // 3. Send to Slack/Discord
    // 4. Log to file
    // 5. Send to analytics service

    // For now, we'll log to console (you can replace this with your preferred method)
    console.log('📝 New Feedback Received:', {
      feedback: feedback.trim(),
      userEmail: userEmail || 'Anonymous',
      page,
      userAgent,
      timestamp,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    })

    // Optional: Send email notification to yourself
    // You could use services like:
    // - Resend (resend.com)
    // - SendGrid
    // - Nodemailer
    // - AWS SES
    
    // Example structure for future email implementation:
    /*
    const emailData = {
      to: 'your@email.com',
      subject: 'New Feedback - Career Journey AI',
      text: `
        New feedback received:
        
        Feedback: ${feedback}
        User Email: ${userEmail || 'Not provided'}
        Page: ${page}
        Time: ${timestamp}
        User Agent: ${userAgent}
      `
    }
    
    // await sendEmail(emailData)
    */

    return NextResponse.json(
      { 
        success: true, 
        message: 'Feedback submitted successfully' 
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
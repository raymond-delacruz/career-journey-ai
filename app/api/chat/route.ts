import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, temperature = 0.7, max_tokens = 150, feedbackMode = false, conversationHistory = [], feedbackType, emailThread } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    console.log('🤖 Chat API: Generating response with OpenAI')
    
    // Handle email feedback generation
    if (feedbackType === 'email' && emailThread) {
      const emailContent = emailThread.map((email: any) => 
        `From: ${email.from}\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.content}`
      ).join('\n\n---\n\n')

      const feedbackPrompt = `As an expert negotiation coach, analyze this email negotiation thread and provide structured feedback. Focus on communication effectiveness, negotiation strategy, and professional tone.

Email Thread:
${emailContent}

Please provide feedback in the following JSON format:
{
  "overallScore": [score from 1-10],
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["improvement1", "improvement2", "improvement3"],
  "nextSteps": ["step1", "step2", "step3"],
  "keyInsights": ["insight1", "insight2"]
}

Focus on:
- Professional tone and clarity
- Negotiation tactics used
- Value proposition presentation
- Relationship building
- Strategic timing and pacing
- Evidence and justification provided
- Closing techniques

Provide specific, actionable feedback that helps improve negotiation skills.`

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert negotiation coach providing structured feedback on email negotiations. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: feedbackPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      })

      const feedbackContent = completion.choices[0]?.message?.content
      
      try {
        const structuredFeedback = JSON.parse(feedbackContent || '{}')
        return NextResponse.json({
          feedback: structuredFeedback,
          usage: completion.usage
        })
      } catch (parseError) {
        // Fallback if JSON parsing fails
        return NextResponse.json({
          feedback: {
            overallScore: 7,
            strengths: ["Professional communication", "Clear structure", "Appropriate tone"],
            areasForImprovement: ["Could be more specific", "Add more supporting evidence", "Consider timing"],
            nextSteps: ["Follow up professionally", "Prepare for next round", "Document agreements"],
            keyInsights: ["Communication style matters", "Preparation is key"]
          },
          usage: completion.usage
        })
      }
    }
    
    // Enhanced prompt for structured feedback when requested
    if (feedbackMode && conversationHistory.length > 0) {
      const feedbackPrompt = `
You are an expert negotiation coach. Analyze this negotiation conversation and provide structured feedback in the following JSON format:

{
  "strengths": [
    "Specific thing the user did well",
    "Another strength with concrete example"
  ],
  "areasForImprovement": [
    "Specific, actionable suggestion for improvement",
    "Another concrete improvement with how-to guidance"
  ],
  "nextSteps": [
    "Concrete action to practice next time",
    "Specific skill to develop further"
  ],
  "overallScore": 7.5,
  "keyInsights": [
    "Important negotiation insight from this conversation",
    "Strategic observation about their approach"
  ]
}

Conversation History:
${conversationHistory.map((msg: any, i: number) => `${i + 1}. ${msg.speaker}: ${msg.message}`).join('\n')}

Focus on:
- Specific examples from their conversation
- Actionable advice they can implement immediately
- Professional negotiation techniques they used well or could improve
- Strategic thinking and approach
- Communication style and effectiveness

Be encouraging but honest. Provide concrete, actionable feedback that will help them improve their negotiation skills.`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert negotiation coach providing structured, actionable feedback. Always respond with valid JSON format as requested.'
          },
          {
            role: 'user',
            content: feedbackPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent structured output
        max_tokens: 800,
      })

      console.log('✅ Chat API: Structured feedback generated successfully')
      
      try {
        const feedbackContent = completion.choices[0].message.content?.trim()
        const structuredFeedback = JSON.parse(feedbackContent || '{}')
        
        return NextResponse.json({
          feedback: structuredFeedback,
          usage: completion.usage
        })
      } catch (parseError) {
        console.error('Failed to parse structured feedback, falling back to text:', parseError)
        return NextResponse.json({
          feedback: {
            strengths: ["You engaged actively in the negotiation"],
            areasForImprovement: ["Continue practicing to refine your approach"],
            nextSteps: ["Try another negotiation scenario"],
            overallScore: 7.0,
            keyInsights: ["Keep practicing to build confidence"]
          },
          usage: completion.usage
        })
      }
    }
    
    // Regular conversation mode
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: temperature,
      max_tokens: max_tokens,
    })

    console.log('✅ Chat API: Response generated successfully')
    
    return NextResponse.json({
      choices: completion.choices,
      usage: completion.usage
    })

  } catch (error) {
    console.error('❌ Chat API Error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
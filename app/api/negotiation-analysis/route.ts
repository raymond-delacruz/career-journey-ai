export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

interface OfferData {
  position: string
  company: string
  baseSalary: number
  marketRange?: {
    min: number
    max: number
  }
  equity?: string
  bonus?: number
  benefits?: string[]
  rawText?: string
}

interface NegotiationAnalysisRequest {
  offerData: OfferData
  userPreferences?: {
    priorities: string[]
    targetSalary?: number
    mustHaves?: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const { offerData, userPreferences }: NegotiationAnalysisRequest = await request.json()
    
    // Generate AI analysis using ChatGPT
    const analysis = await generateNegotiationAnalysis(offerData, userPreferences)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error generating negotiation analysis:', error)
    return NextResponse.json(
      { error: 'Failed to generate negotiation analysis' },
      { status: 500 }
    )
  }
}

async function generateNegotiationAnalysis(
  offerData: OfferData,
  userPreferences?: {
    priorities: string[]
    targetSalary?: number
    mustHaves?: string[]
  }
): Promise<any> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  
  if (!openaiApiKey || openaiApiKey === '') {
    console.log('OpenAI API key not configured, returning fallback analysis')
    return generateFallbackAnalysis(offerData)
  }

  // Calculate market position
  const marketPosition = offerData.marketRange ? 
    ((offerData.baseSalary - offerData.marketRange.min) / (offerData.marketRange.max - offerData.marketRange.min)) * 100 : 50

  // Create comprehensive context for ChatGPT
  const offerContext = `
OFFER DETAILS:
Position: ${offerData.position}
Company: ${offerData.company}
Base Salary: $${offerData.baseSalary.toLocaleString()}
Market Range: $${offerData.marketRange?.min?.toLocaleString()} - $${offerData.marketRange?.max?.toLocaleString()}
Market Position: ${marketPosition.toFixed(1)}th percentile
Equity: ${offerData.equity || 'Not specified'}
Signing Bonus: ${offerData.bonus ? `$${offerData.bonus.toLocaleString()}` : 'None'}
Benefits: ${offerData.benefits?.join(', ') || 'Standard package'}

USER PREFERENCES:
${userPreferences ? `
Priorities: ${userPreferences.priorities?.join(', ') || 'Not specified'}
Target Salary: ${userPreferences.targetSalary ? `$${userPreferences.targetSalary.toLocaleString()}` : 'Not specified'}
Must-Have Items: ${userPreferences.mustHaves?.join(', ') || 'Not specified'}
` : 'Not provided'}
`

  const prompt = `You are an expert salary negotiation coach and compensation consultant with 20+ years of experience helping professionals negotiate job offers across various industries and company stages. 

Analyze this job offer and provide a comprehensive negotiation strategy with specific, actionable recommendations.

${offerContext}

Please provide a detailed analysis in the following structure:

OFFER ASSESSMENT
- Overall Competitiveness: Rate the offer 1-10 and explain why
- Market Position Analysis: How this offer compares to market standards
- Total Compensation Value: Break down all components and their relative value
- Red Flags & Opportunities: What stands out positively or negatively

NEGOTIATION LEVERAGE ANALYSIS
- Your Strongest Negotiation Points: Based on market data and offer structure
- Company's Likely Flexibility: Which components they're most/least likely to negotiate
- Timing Considerations: Best approach for when and how to negotiate
- Risk Assessment: Potential downsides and how to mitigate them

SPECIFIC NEGOTIATION STRATEGIES
- Primary Negotiation Targets: Top 3 areas to focus on with specific dollar amounts/percentages
- Secondary Opportunities: Additional areas that could be negotiated
- Negotiation Sequence: Order of requests for maximum effectiveness
- Fallback Positions: Alternative asks if primary requests are declined

CONVERSATION FRAMEWORKS
- Opening Statement: How to start the negotiation conversation professionally
- Key Talking Points: Specific arguments and justifications to use
- Questions to Ask: Information gathering questions about flexibility
- Common Objections & Responses: How to handle pushback professionally

TIMING AND PACING STRATEGY
- Ideal Response Time: How long to take considering the offer before negotiating
- Conversation Pacing: Optimal length and structure for negotiation calls/emails
- Decision Timeline: How to manage offer deadlines and create appropriate urgency
- Follow-up Timing: When and how often to follow up during negotiations

TACTICAL RECOMMENDATIONS
- Email vs. Phone vs. In-Person: Best communication method for each request
- Timeline Strategy: When to make requests relative to offer deadline
- Documentation Approach: What to get in writing and when
- Relationship Management: How to maintain positive relationship throughout

SPECIFIC SCRIPTS & TEMPLATES
- Email templates for different negotiation scenarios
- Phone conversation openers and key phrases
- Response templates for common company replies
- Thank you and follow-up message examples

ALTERNATIVE SCENARIOS
- If salary increase is rejected: Other valuable compensation to request
- If budget is truly fixed: Non-monetary benefits that add value
- If negotiation fails: How to accept gracefully while preserving relationships
- Future negotiation setup: How to position for next review cycle

SUCCESS METRICS & EXPECTATIONS
- Realistic outcome ranges for each negotiation target
- Timeline expectations for responses and decisions
- Signs that negotiation is going well vs. concerning signals
- When to stop negotiating and accept/decline

VOICE NEGOTIATION COACHING
- Speaking pace and tone recommendations for phone/video negotiations
- Optimal response times during live conversations (15-45 seconds for complex topics)
- How to handle silence and pauses effectively
- Body language and vocal confidence techniques
- Managing nerves and maintaining composure during live negotiations

Be specific with dollar amounts, percentages, and exact phrases to use. Consider the current job market, industry standards, and company size. Provide both conservative and aggressive negotiation approaches. Focus on win-win outcomes that benefit both parties.

Include specific timing advice for both written and verbal communications. Address pacing strategies for live negotiations including ideal response times, when to pause for effect, and how to manage conversation flow.

Make your advice actionable, professional, and relationship-preserving while maximizing the candidate's compensation and satisfaction.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using the most capable model for complex negotiation analysis
        messages: [
          {
            role: 'system',
            content: 'You are an expert salary negotiation coach and compensation consultant. Provide detailed, strategic, and actionable negotiation advice. Be specific with numbers, scripts, and tactics. Always maintain a professional tone while maximizing value for the candidate. Do not use markdown formatting - use plain text with clear headers and bullet points.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    let analysisText = data.choices?.[0]?.message?.content?.trim()

    if (!analysisText) {
      throw new Error('No analysis generated from ChatGPT')
    }

    // Clean up any markdown formatting
    analysisText = analysisText
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove ** bold formatting
      .replace(/####\s*/g, '') // Remove #### headers
      .replace(/###\s*/g, '') // Remove ### headers  
      .replace(/##\s*/g, '') // Remove ## headers
      .replace(/\*\s*/g, '- ') // Convert * bullets to - bullets
      .trim()

    // Parse the analysis into structured sections for better UI display
    const sections = parseAnalysisIntoSections(analysisText)

    return {
      rawAnalysis: analysisText,
      sections: sections,
      offerScore: extractOfferScore(analysisText),
      topPriorities: extractTopPriorities(analysisText),
      marketPosition: marketPosition,
      generatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error('ChatGPT API error:', error)
    
    // Fallback analysis
    return generateFallbackAnalysis(offerData)
  }
}

function parseAnalysisIntoSections(analysisText: string) {
  const sections: { [key: string]: string } = {}
  
  // Define section headers to look for
  const sectionHeaders = [
    'OFFER ASSESSMENT',
    'NEGOTIATION LEVERAGE ANALYSIS', 
    'SPECIFIC NEGOTIATION STRATEGIES',
    'CONVERSATION FRAMEWORKS',
    'TACTICAL RECOMMENDATIONS',
    'SPECIFIC SCRIPTS & TEMPLATES',
    'ALTERNATIVE SCENARIOS',
    'SUCCESS METRICS & EXPECTATIONS'
  ]
  
  let currentSection = ''
  let currentContent = ''
  
  const lines = analysisText.split('\n')
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Check if this line is a section header
    const foundHeader = sectionHeaders.find(header => 
      trimmedLine.toUpperCase().includes(header)
    )
    
    if (foundHeader) {
      // Save previous section if it exists
      if (currentSection && currentContent.trim()) {
        sections[currentSection] = currentContent.trim()
      }
      
      // Start new section
      currentSection = foundHeader
      currentContent = ''
    } else if (currentSection) {
      // Add content to current section
      currentContent += line + '\n'
    }
  }
  
  // Save the last section
  if (currentSection && currentContent.trim()) {
    sections[currentSection] = currentContent.trim()
  }
  
  return sections
}

function extractOfferScore(analysisText: string): number {
  // Look for patterns like "Rate the offer 8/10" or "Overall Competitiveness: 7"
  const scorePatterns = [
    /rate.*offer.*(\d+)\/10/i,
    /competitiveness.*(\d+)/i,
    /score.*(\d+)/i,
    /(\d+)\/10/i
  ]
  
  for (const pattern of scorePatterns) {
    const match = analysisText.match(pattern)
    if (match && match[1]) {
      const score = parseInt(match[1])
      if (score >= 1 && score <= 10) {
        return score
      }
    }
  }
  
  return 7 // Default score
}

function extractTopPriorities(analysisText: string): string[] {
  const priorities: string[] = []
  
  // Look for numbered lists or bullet points in negotiation strategies section
  const strategiesMatch = analysisText.match(/SPECIFIC NEGOTIATION STRATEGIES([\s\S]*?)(?=CONVERSATION FRAMEWORKS|$)/i)
  
  if (strategiesMatch) {
    const strategiesText = strategiesMatch[1]
    const lines = strategiesText.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine.match(/^[1-3]\.|^-\s/)) {
        const priority = trimmedLine.replace(/^[1-3]\.\s*|-\s*/, '').trim()
        if (priority && priority.length > 10) {
          priorities.push(priority)
        }
      }
    }
  }
  
  return priorities.slice(0, 3) // Return top 3 priorities
}

function generateFallbackAnalysis(offerData: OfferData) {
  const marketPosition = offerData.marketRange ? 
    ((offerData.baseSalary - offerData.marketRange.min) / (offerData.marketRange.max - offerData.marketRange.min)) * 100 : 50
  
  const offerScore = marketPosition > 80 ? 9 : marketPosition > 60 ? 7 : marketPosition > 40 ? 6 : 5
  
  return {
    rawAnalysis: `Negotiation Analysis for ${offerData.position} at ${offerData.company}

OFFER ASSESSMENT
Your offer appears to be ${marketPosition > 70 ? 'competitive' : marketPosition > 50 ? 'fair' : 'below market'} based on the ${marketPosition.toFixed(1)}th percentile position.

NEGOTIATION STRATEGIES
1. Focus on base salary adjustment if below 70th percentile
2. Request signing bonus if not included (target $8,000-$15,000)
3. Negotiate additional benefits like remote work flexibility

The analysis service is temporarily unavailable. Please try again shortly for detailed negotiation strategies and scripts.`,
    sections: {
      'OFFER ASSESSMENT': `Your offer is at the ${marketPosition.toFixed(1)}th percentile of the market range.`,
      'NEGOTIATION STRATEGIES': 'Focus on base salary, signing bonus, and flexible benefits.'
    },
    offerScore: offerScore,
    topPriorities: [
      'Salary adjustment to market rate',
      'Signing bonus negotiation', 
      'Benefits enhancement'
    ],
    marketPosition: marketPosition,
    generatedAt: new Date().toISOString()
  }
} 
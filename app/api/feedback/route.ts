export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

interface TranscriptEntry {
  question: string
  answer: string
  timestamp: Date
  sqlCode?: string
}

interface FeedbackRequest {
  transcript: TranscriptEntry[]
  jobTitle: string
  level: string
  companyStage?: string
  stage?: string
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, jobTitle, level, companyStage, stage }: FeedbackRequest = await request.json()
    
    // Generate AI feedback using OpenAI
    const feedback = await generateAIFeedback(transcript, jobTitle, level, companyStage, stage)

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Error generating feedback:', error)
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 }
    )
  }
}

async function generateAIFeedback(
  transcript: TranscriptEntry[],
  jobTitle: string,
  level: string,
  companyStage?: string,
  stage?: string
): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Create a comprehensive prompt for ChatGPT
  const interviewContext = `
Job Title: ${jobTitle}
Experience Level: ${level}
Interview Stage: ${stage || 'General Interview'}
Company Stage: ${companyStage || 'Not specified'}

Interview Questions and Answers:
${transcript.map((entry, index) => `
Q${index + 1}: ${entry.question}
A${index + 1}: ${entry.answer}
${entry.sqlCode ? `SQL Code: ${entry.sqlCode}` : ''}
`).join('\n')}
`

  const stageSpecificContext = getStageSpecificContext(stage || 'General Interview')
  const companyStageContext = getCompanyStageContext(companyStage || '')

  const prompt = `You are an expert interview coach and hiring manager with 15+ years of experience. Analyze this ${stage || 'general'} interview performance and provide detailed, constructive feedback with numerical scores.

${interviewContext}

IMPORTANT: This is a ${stage || 'General Interview'} stage interview for a ${companyStage || 'general company'} environment. ${stageSpecificContext}

Company Stage Context: ${companyStageContext}

For ${jobTitle} at ${level} level in a ${stage || 'general'} interview at a ${companyStage || 'company'}, focus on:
${getRoleSpecificCriteria(jobTitle, level, companyStage)}

Please provide comprehensive feedback in the following format:

${stage || 'General'} Interview Performance Analysis for ${jobTitle} (${level}) at ${companyStage || 'Company'}

Overall Assessment
- Overall Score: X/100 (where 100 is exceptional, 90+ is excellent, 80+ is very good, 70+ is good, 60+ is fair, below 60 needs improvement)
- Brief summary (2-3 sentences) specific to ${stage || 'general'} interview expectations for ${companyStage || 'company'} environments

Performance Breakdown (Individual Scores /10)
${getRoleSpecificScoreCategories(jobTitle, level, companyStage)}

Strengths
- List 3-4 specific strengths demonstrated for a ${stage || 'general'} interview at a ${companyStage || 'company'}
- Reference specific answers and quote key phrases
- Explain why these are valuable for a ${jobTitle} role at this company stage

Areas for Improvement
- List 3-4 areas that need work with specific scores for ${stage || 'general'} interviews at ${companyStage || 'company'} environments
- Be specific and actionable for ${level} ${jobTitle} positions in this company context
- Reference specific answers that could be enhanced for this interview stage and company type

Question-by-Question Analysis
For each question, provide:
- Score: X/10
- What you did well: Specific positive elements for this interview stage and company context
- What to improve: Specific weaknesses or gaps for ${stage || 'general'} interviews at ${companyStage || 'company'} environments
- Better answer example: Provide a sample improved response using STAR method, tailored for ${jobTitle} roles in ${stage || 'general'} interviews at ${companyStage || 'company'} companies
- Key phrases to include: Role-specific terminology and concepts for ${jobTitle} appropriate for ${stage || 'general'} stage at ${companyStage || 'company'} environments

${stage || 'General'} Interview Stage Recommendations for ${companyStage || 'Company'} Environment
1. Stage-Specific Skills (for ${stage || 'general'} interviews at ${companyStage || 'company'} companies):
   - 3 specific areas to focus on for this interview stage and company context
2. ${jobTitle} Interview Strategies (for ${stage || 'general'} stage at ${companyStage || 'company'} companies):
   - Key approaches and preparation tactics for this stage and company type
3. Next Stage Preparation (if this was ${stage || 'general'} at ${companyStage || 'company'}):
   - How to prepare for subsequent interview rounds in this company context

Interview Readiness Assessment
- Ready for ${stage || 'general'} ${level} ${jobTitle} interviews at ${companyStage || 'company'} companies: Yes/No with explanation
- Estimated success rate: X% for similar ${stage || 'general'} ${jobTitle} interviews at ${companyStage || 'company'} environments
- Stage-specific preparation time: X days/weeks for ${stage || 'general'} readiness at ${companyStage || 'company'} companies
- Recommended next steps: Based on ${stage || 'general'} interview performance for ${companyStage || 'company'} context

Sample Improved Responses (${stage || 'General'} Interview Focused for ${companyStage || 'Company'})
Provide 2-3 completely rewritten answers showing:
- Better structure appropriate for ${stage || 'general'} interviews at ${companyStage || 'company'} companies
- ${jobTitle}-specific examples and metrics suitable for this stage and company context
- Industry-relevant terminology appropriate for ${stage || 'general'} conversations at ${companyStage || 'company'} environments
- ${level}-appropriate depth and complexity for this interview stage and company type

Be encouraging but honest. Provide specific examples and actionable feedback tailored to ${stage || 'general'} ${jobTitle} interviews at ${companyStage || 'company'} companies. Use a professional but supportive tone. Focus on helping them succeed in this specific interview stage and company environment.`

  // Helper function to get company stage-specific context
  function getCompanyStageContext(companyStage: string): string {
    switch (companyStage) {
      case 'Early (Pre-Seed, Seed)':
        return `Early-stage startups value versatility, scrappiness, and the ability to work with limited resources. They look for candidates who can wear multiple hats, adapt quickly, and thrive in uncertain environments. Emphasis on building from scratch, rapid iteration, and high risk tolerance.`
      
      case 'Growth Stage (Series A/B/C/D+)':
        return `Growth-stage companies focus on scaling operations, optimizing processes, and expanding market presence. They seek candidates who can handle increased complexity, build scalable systems, and drive operational efficiency while maintaining startup agility.`
      
      case 'Late Stage: Pre-IPO / Mature Private':
        return `Late-stage companies emphasize governance, compliance, and preparation for public markets. They value candidates with experience in structured environments, stakeholder management, and the ability to operate under increased scrutiny and regulatory requirements.`
      
      case 'Post-Exit: Public Company':
        return `Public companies prioritize quarterly performance, shareholder value, and regulatory compliance. They seek candidates who can deliver consistent results, manage public scrutiny, and operate within established frameworks while driving innovation.`
      
      case 'Mega Cap / Big Tech (FAANG)':
        return `Large tech companies focus on scale, innovation, and global impact. They value candidates who can handle massive scale, complex systems, and high performance standards while maintaining technical excellence and cross-functional collaboration.`
      
      default:
        return `Consider the specific company context and stage requirements when evaluating responses.`
    }
  }

  // Helper function to get stage-specific context
  function getStageSpecificContext(stage: string): string {
    switch (stage) {
      case 'Recruiter Screen':
        return `This is typically a preliminary conversation focused on basic qualifications, cultural fit, motivation, and logistics. Answers should be conversational, highlight key experiences, and demonstrate genuine interest in the role and company.`
      
      case 'Hiring Manager Screen':
        return `This interview focuses on job-specific competencies, past experiences, and behavioral questions. Answers should demonstrate relevant skills, leadership potential, and problem-solving abilities with concrete examples.`
      
      case 'Technical Interview':
        return `This stage evaluates technical skills, problem-solving approach, and domain expertise. Answers should showcase technical depth, methodology, best practices, and ability to explain complex concepts clearly.`
      
      case 'SQL Test':
        return `This technical assessment evaluates SQL proficiency, data analysis skills, and business acumen. Focus on query optimization, data interpretation, and translating business requirements into technical solutions.`
      
      case 'Case Study':
        return `This analytical assessment evaluates structured thinking, problem-solving methodology, and business judgment. Focus on framework application, data-driven insights, and actionable recommendations.`
      
      case 'On-site / Final Round':
        return `This comprehensive interview assesses overall fit, team dynamics, and final decision factors. Answers should demonstrate cultural alignment, stakeholder management, and readiness to contribute immediately.`
      
      case 'Executive Interview':
        return `This senior-level conversation focuses on strategic thinking, leadership philosophy, and long-term vision. Answers should show executive presence, change management capabilities, and alignment with company strategy.`
      
      default:
        return `Tailor your analysis to the specific interview context and stage requirements.`
    }
  }

  // Helper function to get role-specific criteria
  function getRoleSpecificCriteria(jobTitle: string, level: string, companyStage?: string): string {
    const title = jobTitle.toLowerCase()
    const stageContext = getCompanyStageSpecificCriteria(companyStage || '')
    
    if (title.includes('data') || title.includes('analyst')) {
      return `
- Statistical analysis and data interpretation skills
- SQL proficiency and database management
- Business acumen and problem framing
- Data visualization and storytelling
- Python/R programming and analytical tools
- ${level === 'Senior Level' ? 'Team leadership and strategy development' : level === 'Entry Level' ? 'Tool proficiency and learning methodology' : 'End-to-end project execution'}
- ${stageContext}`
    }
    
    if (title.includes('product') || title.includes('pm')) {
      return `
- Strategic thinking and product vision
- User empathy and customer research insights
- Data-driven decision making and metrics
- Cross-functional collaboration and influence
- Roadmap planning and prioritization
- ${level === 'Senior Level' ? 'Portfolio management and stakeholder alignment' : level === 'Entry Level' ? 'Feature definition and user story creation' : 'Product-market fit understanding'}
- ${stageContext}`
    }
    
    return `
- Role-specific technical and functional skills
- Problem-solving and analytical thinking
- Communication and collaboration abilities
- Adaptability and learning agility
- ${level}-appropriate depth and experience
- ${stageContext}`
  }

  // Helper function to get company stage-specific criteria
  function getCompanyStageSpecificCriteria(companyStage: string): string {
    switch (companyStage) {
      case 'Early (Pre-Seed, Seed)':
        return `Startup agility, resource constraints management, building from scratch, high uncertainty tolerance`
      
      case 'Growth Stage (Series A/B/C/D+)':
        return `Scaling expertise, process optimization, operational efficiency, rapid growth management`
      
      case 'Late Stage: Pre-IPO / Mature Private':
        return `Governance understanding, compliance awareness, stakeholder management, market readiness`
      
      case 'Post-Exit: Public Company':
        return `Quarterly performance focus, shareholder value creation, regulatory compliance, public scrutiny management`
      
      case 'Mega Cap / Big Tech (FAANG)':
        return `Massive scale handling, complex systems design, high performance standards, global impact thinking`
      
      default:
        return `General business acumen and adaptability`
    }
  }
  
  // Helper function to get role-specific scoring categories
  function getRoleSpecificScoreCategories(jobTitle: string, level: string, companyStage?: string): string {
    const title = jobTitle.toLowerCase()
    
    if (title.includes('software') || title.includes('developer') || title.includes('engineer')) {
      return `- Technical Problem Solving: X/10
- Code Quality & Best Practices: X/10
- System Design Thinking: X/10
- Communication & Collaboration: X/10
- Learning & Adaptability: X/10
- ${level === 'Senior' ? 'Technical Leadership: X/10' : level === 'Entry Level' ? 'Foundational Knowledge: X/10' : 'Project Ownership: X/10'}`
    }
    
    if (title.includes('product') || title.includes('pm')) {
      return `- Product Strategy: X/10
- Product Design: X/10
- Execution: X/10
- Product Sense: X/10
- Tradeoffs and Prioritization: X/10
- Analytics and Metrics: X/10
- Cross Functional Collaboration: X/10`
    }
    
    if (title.includes('data') || title.includes('analyst') || title.includes('scientist')) {
      return `- Statistical Analysis: X/10
- Programming & Tools: X/10
- Business Problem Solving: X/10
- Data Storytelling: X/10
- Technical Communication: X/10
- ${level === 'Senior' ? 'Strategic Leadership: X/10' : level === 'Entry Level' ? 'Tool Proficiency: X/10' : 'Project Execution: X/10'}`
    }
    
    // Default categories for other roles
    return `- Domain Expertise: X/10
- Problem Solving: X/10
- Communication & Clarity: X/10
- Professional Presence: X/10
- Strategic Thinking: X/10
- ${level === 'Senior' ? 'Leadership Potential: X/10' : level === 'Entry Level' ? 'Learning Agility: X/10' : 'Project Management: X/10'}`
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model that's great for this use case
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview coach and hiring manager. Provide detailed, constructive, and encouraging feedback on interview performances. Be specific and actionable in your advice. Always include numerical scores and concrete examples. IMPORTANT: Do not use any markdown formatting like ** for bold text or #### for headers. Use plain text only with clear section headers and bullet points using simple dashes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000, // Increased for comprehensive feedback with scores and examples
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    let feedback = data.choices?.[0]?.message?.content?.trim()

    if (!feedback) {
      throw new Error('No feedback generated from OpenAI')
    }

    // Clean up any remaining markdown formatting
    feedback = feedback
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove ** bold formatting
      .replace(/####\s*/g, '') // Remove #### headers
      .replace(/###\s*/g, '') // Remove ### headers  
      .replace(/##\s*/g, '') // Remove ## headers
      .replace(/\*\s*/g, '- ') // Convert * bullets to - bullets
      .trim()

    return feedback
  } catch (error) {
    console.error('OpenAI API error:', error)
    
    // Fallback to a helpful error message
    return `Interview Feedback Temporarily Unavailable

We're experiencing technical difficulties generating your AI-powered feedback right now. 

Your Interview Summary:
- Position: ${jobTitle} (${level})
- Questions Completed: ${transcript.length}
- Total Response Time: ${transcript.reduce((sum, entry) => sum + entry.answer.length, 0)} characters

Quick Tips While We Fix This:
1. Review your answers for specific examples and quantifiable results
2. Practice the STAR method (Situation, Task, Action, Result) for behavioral questions
3. Research the company's recent news, products, and culture
4. Prepare questions to ask the interviewer

Please try generating feedback again in a few minutes. We apologize for the inconvenience!`
  }
} 
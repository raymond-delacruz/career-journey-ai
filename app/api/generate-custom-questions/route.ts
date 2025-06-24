import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper function to extract text from different file types
async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder().decode(buffer)
  
  // For now, we'll handle plain text files
  // In a production app, you'd want to use proper PDF/DOC parsers
  if (file.type === 'text/plain') {
    return text
  }
  
  // For other file types, return the raw text (this is a simplified approach)
  // In production, you'd use libraries like pdf-parse, mammoth, etc.
  return text
}

// Helper function to scrape job posting from URL
async function scrapeJobFromUrl(url: string): Promise<{ content: string; title?: string }> {
  try {
    console.log('🔍 Starting to scrape URL:', url)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
    }
    
    const html = await response.text()
    console.log('📄 HTML fetched, length:', html.length)
    
    // Check if we're being redirected to a login page or blocked
    const loginIndicators = [
      'sign in', 'sign up', 'login', 'register', 'authentication required',
      'please log in', 'access denied', 'unauthorized', 'forbidden',
      'captcha', 'verify you are human', 'bot detection',
      'linkedin login', 'indeed login', 'glassdoor login'
    ]
    
    const htmlLower = html.toLowerCase()
    const isLoginPage = loginIndicators.some(indicator => 
      htmlLower.includes(indicator) && htmlLower.split(indicator).length > 3 // Multiple occurrences suggest login page
    )
    
    if (isLoginPage) {
      console.log('🚫 Detected login/blocked page')
      throw new Error('This job posting requires authentication to access. Please try copying the job description directly or use a publicly accessible job URL.')
    }
    
    // Check for minimal content that suggests we didn't get the actual job posting
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (textContent.length < 200) {
      console.log('⚠️ Content too short, likely blocked or empty page')
      throw new Error('Unable to extract sufficient content from this URL. The page may be protected or require JavaScript to load properly.')
    }
    
    // Extract job title from HTML before cleaning
    let extractedTitle = ''
    
    // Try multiple approaches to extract the job title
    const titleExtractionPatterns = [
      // Common job site patterns - more specific first
      /<h1[^>]*class="[^"]*job[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/gi,
      /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/gi,
      /<h1[^>]*data-automation="[^"]*job[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/gi,
      
      // Title tag with job-related keywords
      /<title[^>]*>([^<]*(?:Engineer|Developer|Analyst|Manager|Director|Specialist|Coordinator|Assistant|Lead|Senior|Junior|Intern|Scientist|Architect|Consultant|Designer|Writer|Product|Marketing|Sales|Data|Software)[^<]*)<\/title>/gi,
      
      // H1 tags with job-related keywords
      /<h1[^>]*>([^<]*(?:Engineer|Developer|Analyst|Manager|Director|Specialist|Coordinator|Assistant|Lead|Senior|Junior|Intern|Scientist|Architect|Consultant|Designer|Writer|Product|Marketing|Sales|Data|Software)[^<]*)<\/h1>/gi,
      /<h2[^>]*>([^<]*(?:Engineer|Developer|Analyst|Manager|Director|Specialist|Coordinator|Assistant|Lead|Senior|Junior|Intern|Scientist|Architect|Consultant|Designer|Writer|Product|Marketing|Sales|Data|Software)[^<]*)<\/h2>/gi,
      
      // Site-specific patterns
      // LinkedIn specific
      /<h1[^>]*class="[^"]*top[^"]*card[^"]*layout[^"]*"[^>]*>([^<]+)<\/h1>/gi,
      // Indeed specific
      /<h1[^>]*class="[^"]*jobsearch[^"]*JobTitle[^"]*"[^>]*>([^<]+)<\/h1>/gi,
      // Glassdoor specific
      /<h1[^>]*class="[^"]*job[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/gi,
      
      // Generic fallbacks (less reliable)
      /<h1[^>]*>([^<]+)<\/h1>/gi,
      /<title>([^<]+)<\/title>/gi
    ]
    
    for (const pattern of titleExtractionPatterns) {
      const matches = html.match(pattern)
      if (matches && matches.length > 0) {
        // Get the first match and extract the content
        const match = matches[0].match(/>([^<]+)</)
        if (match && match[1]) {
          extractedTitle = match[1].trim()
          console.log('🎯 Found potential title with pattern:', extractedTitle)
          
          // Clean up the title
          extractedTitle = extractedTitle
            .replace(/\s*[-|•·–—]\s*.*$/, '') // Remove everything after separators
            .replace(/\s*\|\s*.*$/, '') // Remove everything after pipe
            .replace(/\s*at\s+.*$/i, '') // Remove company info
            .replace(/\s*\(.*?\).*$/, '') // Remove parenthetical info
            .replace(/\s*job\s*$/i, '') // Remove trailing "job"
            .replace(/^\s*job\s*:?\s*/i, '') // Remove leading "job:"
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
          
          console.log('🧹 Cleaned title:', extractedTitle)
          
          // Validate the title - reject login/error page titles
          const invalidTitleIndicators = [
            'sign in', 'login', 'register', 'error', '404', 'not found',
            'access denied', 'unauthorized', 'forbidden', 'home', 'homepage'
          ]
          
          const titleLower = extractedTitle.toLowerCase()
          const isValidTitle = extractedTitle.length > 3 && 
                             extractedTitle.length < 150 && 
                             !invalidTitleIndicators.some(indicator => titleLower.includes(indicator))
          
          if (isValidTitle) {
            console.log('✅ Valid title found:', extractedTitle)
            break
          } else {
            console.log('❌ Invalid title rejected:', extractedTitle)
            extractedTitle = ''
          }
        }
      }
    }
    
    // Clean HTML to extract text content with better filtering
    const cleanedContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove headers
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // Remove footers
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '') // Remove sidebars
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    console.log('📝 Extracted text content length:', cleanedContent.length)
    console.log('📝 First 200 chars:', cleanedContent.substring(0, 200))
    
    // Final validation - check if content looks like a job posting
    const jobKeywords = [
      'responsibilities', 'requirements', 'qualifications', 'experience',
      'skills', 'education', 'benefits', 'salary', 'position', 'role',
      'team', 'company', 'work', 'job', 'career', 'opportunity'
    ]
    
    const contentLower = cleanedContent.toLowerCase()
    const hasJobKeywords = jobKeywords.some(keyword => contentLower.includes(keyword))
    
    if (!hasJobKeywords && cleanedContent.length < 500) {
      console.log('⚠️ Content doesn\'t appear to be a job posting')
      throw new Error('The extracted content doesn\'t appear to be a job posting. Please verify the URL points to a specific job listing.')
    }
    
    return {
      content: cleanedContent,
      title: extractedTitle || undefined
    }
    
  } catch (error) {
    console.error('❌ Error scraping URL:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // If it's already a custom error message, pass it through
      if (error.message.includes('authentication') || 
          error.message.includes('login') || 
          error.message.includes('blocked') ||
          error.message.includes('job posting')) {
        throw error
      }
      
      // Handle other specific errors
      if (error.message.includes('fetch')) {
        throw new Error('Unable to access the job posting URL. The site may be blocking automated requests or the URL may be incorrect.')
      } else if (error.message.includes('Failed to fetch URL: 4')) {
        throw new Error('Job posting not found (404). Please check the URL and try again.')
      } else if (error.message.includes('Failed to fetch URL: 5')) {
        throw new Error('Server error when accessing the job posting. Please try again later.')
      }
    }
    
    throw new Error(`Failed to scrape job posting: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Helper function to auto-detect job attributes from content
async function autoDetectJobAttributes(jobContent: string): Promise<{
  level?: string
  companyStage?: string
  stage?: string
}> {
  try {
    const prompt = `Analyze the following job posting and extract these attributes. Return ONLY a JSON object with the detected values:

Job Content:
${jobContent}

Please detect and return:
{
  "level": "Entry Level (0-2 years)" | "Mid Level (2-5 years)" | "Senior Level (5-10 years)" | "Executive Level (10+ years)" | null,
  "companyStage": "Early (Pre-Seed, Seed)" | "Growth (Series A-C)" | "Mature (Series D+, IPO)" | "Enterprise (Fortune 500)" | null,
  "stage": "Recruiter Screen" | "Technical Interview" | "Behavioral Interview" | "Case Study" | "Panel Interview" | "Final Round" | null
}

Base your detection on:
- Level: Years of experience mentioned, seniority keywords (junior, senior, lead, principal, etc.)
- Company Stage: Company size, funding stage, industry indicators, benefits/perks mentioned
- Stage: Not detectable from job posting, leave as null

If you cannot confidently detect any attribute, set it to null.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing job postings. Always respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      return {}
    }

    try {
      return JSON.parse(response)
    } catch (parseError) {
      console.error('Failed to parse auto-detection response:', response)
      return {}
    }
  } catch (error) {
    console.error('Error auto-detecting job attributes:', error)
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const inputType = formData.get('inputType') as string
    const level = formData.get('level') as string
    const companyStage = formData.get('companyStage') as string
    const stage = formData.get('stage') as string
    const duration = parseInt(formData.get('duration') as string)
    
    let jobContent = ''
    let jobTitle = 'Custom Position'
    
    // Extract job content based on input type
    switch (inputType) {
      case 'title':
        const customJobTitle = formData.get('jobTitle') as string
        jobContent = `Job Title: ${customJobTitle}`
        jobTitle = customJobTitle.split(' at ')[0] || customJobTitle
        break
        
      case 'description':
        jobContent = formData.get('jobDescription') as string
        // Try to extract job title from description
        const titleMatch = jobContent.match(/(?:job title|position|role):\s*([^\n]+)/i)
        if (titleMatch) {
          jobTitle = titleMatch[1].trim()
        }
        break
        
      case 'file':
        const file = formData.get('jobFile') as File
        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }
        jobContent = await extractTextFromFile(file)
        break
        
      case 'url':
        const jobUrl = formData.get('jobUrl') as string
        try {
          console.log('🔗 Processing URL:', jobUrl)
          const { content, title } = await scrapeJobFromUrl(jobUrl)
          
          if (!content || content.trim().length < 50) {
            return NextResponse.json(
              { 
                error: 'Unable to extract meaningful job content from this URL.',
                details: 'The URL may be protected by authentication, JavaScript rendering, or anti-bot measures. Please try copying the job description directly.'
              },
              { status: 400 }
            )
          }
          
          jobContent = content
          jobTitle = title || 'Position from URL'
          console.log('✅ Successfully scraped job content:', {
            contentLength: jobContent.length,
            detectedTitle: jobTitle,
            preview: jobContent.substring(0, 200)
          })
          
        } catch (error) {
          console.error('❌ URL scraping failed:', error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown scraping error'
          
          return NextResponse.json(
            { 
              error: 'Failed to access or parse the job posting URL.',
              details: errorMessage.includes('fetch') 
                ? 'Unable to access the URL. Please check if it\'s publicly accessible and try again.'
                : errorMessage
            },
            { status: 400 }
          )
        }
        break
        
      default:
        return NextResponse.json({ error: 'Invalid input type' }, { status: 400 })
    }
    
    if (!jobContent.trim()) {
      return NextResponse.json({ error: 'No job content extracted' }, { status: 400 })
    }

    // Auto-detect job attributes from content
    const detectedAttributes = await autoDetectJobAttributes(jobContent)
    
    // Use provided values or fall back to detected ones
    const finalLevel = level || detectedAttributes.level || 'Mid Level (2-5 years)'
    const finalCompanyStage = companyStage || detectedAttributes.companyStage || 'Growth (Series A-C)'
    const finalStage = stage || detectedAttributes.stage || 'Technical Interview'
    
    // Generate custom interview questions using OpenAI
    const prompt = `Based on the following job information, generate ${Math.ceil(duration / 3)} tailored interview questions for a ${finalStage} interview for a ${finalLevel} candidate at a ${finalCompanyStage} company.

Job Information:
${jobContent}

IMPORTANT: Analyze the job content carefully and create questions that are SPECIFICALLY relevant to the role, responsibilities, and requirements mentioned in the job description.

Please generate questions that are:
1. Directly related to the specific role and responsibilities mentioned in the job description
2. Appropriate for the ${finalStage} interview stage
3. Suitable for a ${finalLevel} candidate
4. Relevant to a ${finalCompanyStage} company environment
5. Based on the actual skills, technologies, and requirements listed in the job posting

Return ONLY a valid JSON array with no additional text or explanation. Format:
[
  {
    "question": "Your tailored question here",
    "context": "Brief context about why this question is relevant to the specific job",
    "expectedTopics": ["topic1", "topic2", "topic3"]
  }
]

Focus on creating questions that test the specific competencies, technologies, and skills mentioned in the job description.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert interview coach who creates tailored interview questions based on specific job requirements. You MUST respond with ONLY valid JSON - no additional text, explanations, or formatting. Analyze the job content thoroughly and create questions that are specifically relevant to the role described."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response
    let questions
    try {
      // Clean the response to extract JSON if there's extra text
      let cleanResponse = response.trim()
      
      // Look for JSON array in the response
      const jsonMatch = cleanResponse.match(/\[\s*\{[\s\S]*\}\s*\]/)
      if (jsonMatch) {
        cleanResponse = jsonMatch[0]
      }
      
      questions = JSON.parse(cleanResponse)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response)
      console.error('Parse error:', parseError)
      // Fallback: create generic questions
      questions = [
        {
          question: "Tell me about your experience with this type of role.",
          context: "Understanding candidate's relevant background",
          expectedTopics: ["experience", "skills", "achievements"]
        },
        {
          question: "What interests you most about this position?",
          context: "Assessing motivation and job fit",
          expectedTopics: ["motivation", "career goals", "company interest"]
        },
        {
          question: "How would you approach the key challenges in this role?",
          context: "Problem-solving and strategic thinking",
          expectedTopics: ["problem-solving", "strategy", "methodology"]
        }
      ]
    }

    // Extract job title from content if not already set
    if (jobTitle === 'Custom Position' && inputType !== 'title') {
      console.log('🔍 Attempting to extract job title from content, inputType:', inputType)
      console.log('🔍 Content preview for title extraction:', jobContent.substring(0, 200))
      
      const titlePatterns = [
        // More comprehensive patterns for job title extraction
        /job title:\s*([^\n]+)/i,
        /position:\s*([^\n]+)/i,
        /role:\s*([^\n]+)/i,
        /hiring for:?\s*([^\n]+)/i,
        /we are looking for an?\s*([^\n]+)/i,
        /seeking an?\s*([^\n]+)/i,
        /apply for:?\s*([^\n]+)/i,
        /<title[^>]*>([^<]*(?:engineer|developer|analyst|manager|director|specialist|coordinator|assistant|lead|senior|junior|intern)[^<]*)<\/title>/i,
        /\b(senior|junior|lead|principal|staff|entry.level)?\s*(software|data|product|marketing|sales|business|financial|research|quality|project|program|operations|human resources|hr|customer|technical|systems|network|security|mobile|web|frontend|backend|fullstack|devops|machine learning|ai|artificial intelligence)\s*(engineer|developer|analyst|manager|director|specialist|coordinator|assistant|scientist|architect|consultant|designer|writer|lead|intern)\b/i,
        // Pattern for common job titles in URLs or headings
        /(?:^|\s|>)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Engineer|Developer|Analyst|Manager|Director|Specialist|Coordinator|Assistant|Scientist|Architect|Consultant|Designer|Writer|Lead|Intern)))\b/,
        // Pattern for job titles in h1, h2 tags
        /<h[1-3][^>]*>([^<]*(?:engineer|developer|analyst|manager|director|specialist|coordinator|assistant|lead|senior|junior|intern)[^<]*)<\/h[1-3]>/i
      ]
      
      for (const pattern of titlePatterns) {
        const match = jobContent.match(pattern)
        if (match) {
          console.log('🎯 Found potential title match:', match[1])
          let extractedTitle = match[1].trim()
          
          // Clean up the extracted title
          extractedTitle = extractedTitle
            .replace(/[|•·\-–—]/g, ' ') // Replace separators with spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/^(job|position|role|title|career|opportunity):\s*/i, '') // Remove prefixes
            .replace(/\s*[|•·\-–—].*$/, '') // Remove everything after separators
            .replace(/\s*\(.*?\).*$/, '') // Remove parenthetical information
            .replace(/\s*at\s+.*/i, '') // Remove company info
            .trim()
          
          console.log('🧹 Cleaned title:', extractedTitle)
          
          if (extractedTitle.length > 3 && extractedTitle.length < 100) {
            jobTitle = extractedTitle
            console.log('✅ Final job title set to:', jobTitle)
            break
          }
        }
      }
      
      // If still no title found, try to extract from URL structure
      if (jobTitle === 'Custom Position' && inputType === 'url') {
        const urlJobTitle = formData.get('jobUrl') as string
        console.log('🔍 Trying to extract title from URL:', urlJobTitle)
        const urlMatch = urlJobTitle.match(/\/([^\/]*(?:engineer|developer|analyst|manager|director|specialist|coordinator|assistant|lead|senior|junior|intern)[^\/]*)/i)
        if (urlMatch) {
          jobTitle = urlMatch[1]
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim()
          console.log('🌐 Extracted title from URL:', jobTitle)
        }
      }
      
      console.log('🏁 Final job title result:', jobTitle)
    }

    return NextResponse.json({
      questions,
      jobTitle,
      detectedAttributes, // Return the detected attributes to the frontend
      success: true
    })

  } catch (error) {
    console.error('Error generating custom questions:', error)
    return NextResponse.json(
      { error: 'Failed to generate custom questions' },
      { status: 500 }
    )
  }
} 
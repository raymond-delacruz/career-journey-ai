export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Please enter a valid URL' },
        { status: 400 }
      )
    }

    // Check if URL is accessible
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return NextResponse.json(
          { error: `URL returned ${response.status}: ${response.statusText}` },
          { status: 400 }
        )
      }

      // Check if it's likely a job posting URL
      const hostname = new URL(url).hostname.toLowerCase()
      const jobSites = [
        'linkedin.com',
        'indeed.com',
        'glassdoor.com',
        'monster.com',
        'ziprecruiter.com',
        'careerbuilder.com',
        'dice.com',
        'stackoverflow.com',
        'angel.co',
        'wellfound.com',
        'lever.co',
        'greenhouse.io',
        'workday.com',
        'smartrecruiters.com',
        'jobs.',
        'careers.',
        'hiring.',
        'talent.',
      ]

      const isJobSite = jobSites.some(site => 
        hostname.includes(site) || 
        hostname.startsWith(site.replace('.', '')) ||
        url.toLowerCase().includes('/job') ||
        url.toLowerCase().includes('/career') ||
        url.toLowerCase().includes('/position')
      )

      if (!isJobSite) {
        return NextResponse.json(
          { 
            warning: 'This doesn\'t appear to be a job posting URL. We\'ll still try to extract relevant information.',
            valid: true 
          },
          { status: 200 }
        )
      }

      return NextResponse.json(
        { valid: true, message: 'URL is accessible and appears to be a job posting' },
        { status: 200 }
      )

    } catch (fetchError) {
      console.error('URL validation fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Unable to access this URL. Please check if it\'s publicly accessible.' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('URL validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate URL' },
      { status: 500 }
    )
  }
} 
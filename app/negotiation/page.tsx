'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Room, Track, createLocalAudioTrack } from 'livekit-client'
import { useOpenAITTS } from '../../hooks/useOpenAITTS'

type NegotiationMode = 'analysis' | 'email' | 'voice'

interface EmailMessage {
  id: number
  sender: 'user' | 'hiring_manager'
  subject: string
  content: string
  timestamp: string
}

export default function NegotiationCoach() {
  const router = useRouter()
  const [mode, setMode] = useState<NegotiationMode>('analysis')
  const [offerFile, setOfferFile] = useState<File | null>(null)
  const [offerText, setOfferText] = useState('')
  const [inputMethod, setInputMethod] = useState<'file' | 'text' | 'manual'>('file')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [isEditingData, setIsEditingData] = useState(false)
  
  // Simple separate state for base salary
  const [baseSalaryInput, setBaseSalaryInput] = useState('')
  
  // Add new state for enhanced analysis
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Email practice states
  const [emailThread, setEmailThread] = useState<EmailMessage[]>([])
  const [currentEmailDraft, setCurrentEmailDraft] = useState('')
  const [isEmailPracticeActive, setIsEmailPracticeActive] = useState(false)

  // Voice practice states
  const [isVoicePracticeActive, setIsVoicePracticeActive] = useState(false)
  const [voiceScenario, setVoiceScenario] = useState('')

  // Add missing state variables for timer functions
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [totalSessionTime, setTotalSessionTime] = useState(0)
  const [turnStartTime, setTurnStartTime] = useState<Date | null>(null)
  const [currentTurnTime, setCurrentTurnTime] = useState(0)

  const [targetSalary, setTargetSalary] = useState(0)
  const [showOutcomeInput, setShowOutcomeInput] = useState(false)
  
  // Add missing state variables referenced in useEffect hooks
  const [isHiringManagerSpeaking, setIsHiringManagerSpeaking] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [liveKitToken, setLiveKitToken] = useState<any>(null)
  const [liveKitRoom, setLiveKitRoom] = useState<any>(null)
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false)
  const [liveKitError, setLiveKitError] = useState<string | null>(null)
  const [isPreparingToListen, setIsPreparingToListen] = useState(false)
  
  // Add missing refs
  const hiringManagerSpeakingRef = useRef(false)
  const isListeningRef = useRef(false)
  const sessionStartedRef = useRef(false)

  const recognitionRef = useRef<any>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxRecordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingResponseRef = useRef(false)
  const lastResponseKeyRef = useRef<string | null>(null)
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')

  // ADD: Session Analytics State (Step 1)
  const [sessionAnalytics, setSessionAnalytics] = useState({
    totalFillerWords: 0,
    responseCount: 0,
    avgResponseTime: 0,
    responses: [] as Array<{
      text: string,
      timestamp: number,
      fillerCount: number,
      duration: number
    }>
  })

  // Enhanced Analysis Settings
  const [enhancedAnalysisEnabled, setEnhancedAnalysisEnabled] = useState(true)

  // ADD: Filler Word Detection Function
  const countFillerWords = (text: string): number => {
    const fillers = ["um", "uh", "like", "you know", "so", "actually", "basically", "literally", "i mean", "sort of", "kind of"]
    const lowerText = text.toLowerCase()
    return fillers.reduce((acc, word) => {
      const regex = new RegExp(`\\b${word}\\b`, "gi")
      const matches = lowerText.match(regex) || []
      return acc + matches.length
    }, 0)
  }

  // ADD: Function to Update Session Analytics
  const updateSessionAnalytics = (userMessage: string, duration: number) => {
    const fillerCount = countFillerWords(userMessage)
    const timestamp = Date.now()
    
    setSessionAnalytics(prev => {
      const newResponses = [...prev.responses, {
        text: userMessage,
        timestamp,
        fillerCount,
        duration
      }]
      
      const newTotalFillers = prev.totalFillerWords + fillerCount
      const newResponseCount = prev.responseCount + 1
      const totalDuration = newResponses.reduce((sum, r) => sum + r.duration, 0)
      const newAvgResponseTime = totalDuration / newResponseCount
      
      return {
        totalFillerWords: newTotalFillers,
        responseCount: newResponseCount,
        avgResponseTime: newAvgResponseTime,
        responses: newResponses
      }
    })
    
    console.log('📊 Session Analytics Updated:', {
      message: userMessage.substring(0, 50) + '...',
      fillerCount,
      duration,
      totalFillers: sessionAnalytics.totalFillerWords + fillerCount
    })
  }

  const [currentStep, setCurrentStep] = useState(1)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type and size
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png']
      const maxSize = 10 * 1024 * 1024 // 10MB
      
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a PDF, DOC, DOCX, TXT, JPG, or PNG file')
        return
      }
      
      if (file.size > maxSize) {
        alert('File size must be less than 10MB')
        return
      }
      
      setOfferFile(file)
    }
  }

  const analyzeOffer = async () => {
    setIsAnalyzing(true)
    
    try {
      let textToAnalyze = ''
      
      if (inputMethod === 'text') {
        textToAnalyze = offerText
        console.log('Analyzing pasted text:', textToAnalyze.substring(0, 200) + '...')
      } else if (offerFile) {
        // File processing logic here
        const reader = new FileReader()
        
        return new Promise((resolve) => {
          reader.onload = (e) => {
            textToAnalyze = e.target?.result as string
            console.log('Analyzing file content:', textToAnalyze.substring(0, 200) + '...')
            processText(textToAnalyze)
            resolve(undefined)
          }
          reader.readAsText(offerFile)
        })
      }
      
      if (inputMethod === 'text') {
        processText(textToAnalyze)
      }
      
    } catch (error) {
      console.error('Error analyzing offer:', error)
      alert('Error analyzing offer. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  const processText = (text: string) => {
    console.log('Processing text of length:', text.length)
    const parsed = parseOfferText(text)
    console.log('Parsed data:', parsed)
    setExtractedData(parsed)
  }

  // Function to parse offer text and extract key information
  const parseOfferText = (text: string) => {
    const lowerText = text.toLowerCase()
    
    console.log('🔍 Parsing offer text:', { textLength: text.length, preview: text.substring(0, 200) })
    
    // Extract position/role with improved patterns
    const positionPatterns = [
      /(?:position|role|title)(?:\s+of)?[:]\s*([^\n,.]+)/i,
      /(?:offer|position)(?:\s+for)?(?:\s+the)?(?:\s+role)?(?:\s+of)?[:]\s*([^\n,.]+)/i,
      /(?:as|for)(?:\s+a)?(?:\s+an)?(?:\s+the)?\s*([A-Z][a-zA-Z\s]+?)(?:\s+at|\s+with|\s+position|\s+role)/i,
      /([A-Z][a-zA-Z\s]+?)\s+(?:position|role)(?:\s+at)?/i,
      /join\s+(?:us\s+)?(?:as\s+)?(?:a\s+|an\s+|the\s+)?([A-Z][a-zA-Z\s]+?)(?:\s+at|\s+with|\.|\n)/i,
      /pleased\s+to\s+offer\s+you\s+the\s+(?:position\s+of\s+)?([^\n,.]+)/i
    ]
    
    let position = 'Position Not Found'
    for (const pattern of positionPatterns) {
      const match = text.match(pattern)
      if (match && match[1] && match[1].trim().length > 2) {
        position = match[1].trim().replace(/\s+/g, ' ')
        console.log('📍 Found position:', position)
        break
      }
    }
    
    // Extract company name with improved patterns
    const companyPatterns = [
      /(?:at|with|join)\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s+(?:inc|llc|corp|ltd|co|company)\.?)?(?:\s|,|\.|$)/i,
      /([A-Z][a-zA-Z\s&.,]+?)\s+(?:inc|llc|corp|ltd|co|company)\.?/i,
      /welcome\s+to\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s|!|\.)/i,
      /on\s+behalf\s+of\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s|,|\.)/i,
      /from\s+([A-Z][a-zA-Z\s&.,]+?)(?:\s|,|\.)/i,
      /(?:company|organization|firm)[:]\s*([A-Z][a-zA-Z\s&.,]+)/i
    ]
    
    let company = 'Company Not Found'
    for (const pattern of companyPatterns) {
      const match = text.match(pattern)
      if (match && match[1] && match[1].trim().length > 2 && match[1].trim().length < 50) {
        company = match[1].trim().replace(/\s+/g, ' ')
        console.log('🏢 Found company:', company)
        break
      }
    }
    
    // Extract salary with more comprehensive patterns
    const salaryPatterns = [
      /(?:salary|base|annual|compensation)(?:\s+salary)?[:]\s*\$?([\d,]+)(?:k|,000)?(?:\s+per\s+year|\s+annually)?/i,
      /\$?([\d,]+)(?:k|,000)?(?:\s+per\s+year|\s+annually|\s+salary|\s+base)/i,
      /annual\s+(?:base\s+)?salary\s+of\s+\$?([\d,]+)(?:k|,000)?/i,
      /base\s+(?:annual\s+)?salary\s+(?:of\s+)?\$?([\d,]+)(?:k|,000)?/i,
      /compensation\s+(?:package\s+)?(?:of\s+)?\$?([\d,]+)(?:k|,000)?/i,
      /starting\s+salary\s+(?:of\s+)?\$?([\d,]+)(?:k|,000)?/i,
      /\$\s*([\d,]+)(?:k|,000)?\s*(?:per\s+year|annually)/i
    ]
    
    let baseSalary = 0
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const salaryStr = match[1].replace(/,/g, '')
        let salary = parseInt(salaryStr)
        
        // Handle 'k' notation (e.g., "120k" or "120,000")
        if (text.toLowerCase().includes(salaryStr + 'k') || salary < 1000) {
          salary *= 1000
        }
        
        // Validate reasonable salary range
        if (salary >= 30000 && salary <= 1000000) {
          baseSalary = salary
          console.log('💰 Found salary:', baseSalary)
          break
        }
      }
    }
    
    // If no salary found, try to extract any dollar amount that looks like a salary
    if (baseSalary === 0) {
      const dollarAmounts = text.match(/\$\s*([\d,]+)(?:k|,000)?/gi)
      if (dollarAmounts) {
        for (const amount of dollarAmounts) {
          const numStr = amount.replace(/[\$,k]/g, '').trim()
          let num = parseInt(numStr)
          if (amount.toLowerCase().includes('k')) num *= 1000
          if (num >= 30000 && num <= 1000000) {
            baseSalary = num
            console.log('💰 Found salary from dollar amount:', baseSalary)
            break
          }
        }
      }
    }
    
    // Default salary if none found
    if (baseSalary === 0) {
      baseSalary = 100000
      console.log('💰 Using default salary:', baseSalary)
    }
    
    // Extract bonus with improved patterns
    const bonusPatterns = [
      /(?:signing\s+bonus|bonus)[:]\s*\$?([\d,]+)(?:k|,000)?/i,
      /\$?([\d,]+)(?:k|,000)?\s*(?:signing\s+bonus|bonus)/i,
      /bonus\s+(?:of\s+)?\$?([\d,]+)(?:k|,000)?/i,
      /signing\s+bonus\s+(?:of\s+)?\$?([\d,]+)(?:k|,000)?/i
    ]
    
    let bonus = 0
    for (const pattern of bonusPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const bonusStr = match[1].replace(/,/g, '')
        let bonusAmount = parseInt(bonusStr)
        
        if (text.toLowerCase().includes(bonusStr + 'k') || bonusAmount < 1000) {
          bonusAmount *= 1000
        }
        
        if (bonusAmount > 0 && bonusAmount <= 100000) {
          bonus = bonusAmount
          console.log('🎁 Found bonus:', bonus)
          break
        }
      }
    }
    
    // Extract equity with improved patterns
    const equityPatterns = [
      /(?:equity|stock|shares)[:]\s*([\d.]+)%/i,
      /([\d.]+)%\s*(?:equity|stock|shares)/i,
      /(?:equity|stock)\s+(?:options|grant)\s+(?:of\s+)?([\d.]+)%/i,
      /([\d.]+)%\s*(?:stock\s+options|equity\s+grant)/i
    ]
    
    let equity = '0%'
    for (const pattern of equityPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const equityNum = parseFloat(match[1])
        if (equityNum > 0 && equityNum <= 10) {
          equity = match[1] + '%'
          console.log('📈 Found equity:', equity)
          break
        }
      }
    }
    
    // Generate market range based on extracted salary
    const marketRange = {
      min: Math.round(baseSalary * 0.85),
      max: Math.round(baseSalary * 1.25)
    }
    
    // Extract benefits with improved detection
    const benefits: string[] = []
    const benefitKeywords: { [key: string]: string } = {
      'health': 'Health Insurance',
      'medical': 'Health Insurance',
      '401k': '401k Match',
      'retirement': '401k Match',
      'pto': 'PTO',
      'vacation': 'PTO',
      'time off': 'PTO',
      'dental': 'Dental Insurance',
      'vision': 'Vision Insurance',
      'remote': 'Remote Work',
      'work from home': 'Remote Work',
      'flexible': 'Flexible Schedule',
      'insurance': 'Insurance Coverage',
      'life insurance': 'Life Insurance',
      'disability': 'Disability Insurance'
    }
    
    for (const [keyword, benefit] of Object.entries(benefitKeywords)) {
      if (lowerText.includes(keyword) && !benefits.includes(benefit)) {
        benefits.push(benefit)
      }
    }
    
    if (benefits.length === 0) {
      benefits.push('Standard Benefits Package')
    }
    
    console.log('📋 Extracted data:', { position, company, baseSalary, bonus, equity, benefits })
    
    return {
      position,
      company,
      baseSalary,
      marketRange,
      equity,
      bonus,
      benefits,
      rawText: text
    }
  }

  // Enhanced analysis function using ChatGPT API
  const generateAnalysis = async (data: any) => {
    setIsGeneratingAnalysis(true)
    setAnalysisError(null)
    
    try {
      const response = await fetch('/api/negotiation-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offerData: {
            position: data.position,
            company: data.company,
            baseSalary: data.baseSalary,
            marketRange: data.marketRange,
            equity: data.equity,
            bonus: data.bonus || 0,
            benefits: data.benefits || [],
            rawText: data.rawText
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate analysis')
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      return {
        ...data,
        chatgptAnalysis: result.analysis,
        offerScore: result.analysis.offerScore,
        topPriorities: result.analysis.topPriorities,
        // Keep backward compatibility with existing display logic
        strengths: extractStrengthsFromAnalysis(result.analysis.rawAnalysis),
        improvements: extractImprovementsFromAnalysis(result.analysis.rawAnalysis),
        negotiationPriorities: result.analysis.topPriorities || []
      }
    } catch (error) {
      console.error('Error generating ChatGPT analysis:', error)
      setAnalysisError(error instanceof Error ? error.message : 'Failed to generate analysis')
      
      // Fallback to basic analysis
      return generateBasicAnalysis(data)
    } finally {
      setIsGeneratingAnalysis(false)
    }
  }

  // Fallback basic analysis (original logic)
  const generateBasicAnalysis = (data: any) => {
    const salaryPercentile = (data.baseSalary - data.marketRange.min) / (data.marketRange.max - data.marketRange.min)
    
    const strengths = []
    const improvements = []
    const negotiationPriorities = []
    
    // Analyze salary
    if (salaryPercentile > 0.7) {
      strengths.push('Base salary is competitive for the market')
    } else if (salaryPercentile < 0.3) {
      improvements.push('Base salary is below market average')
      negotiationPriorities.push(`Request salary increase to $${Math.round(data.marketRange.max * 0.9).toLocaleString()}`)
    } else {
      improvements.push('Base salary could be increased by 10-15%')
      negotiationPriorities.push(`Request salary increase to $${Math.round(data.baseSalary * 1.15).toLocaleString()}`)
    }
    
    // Analyze bonus
    if (data.bonus > 0) {
      strengths.push(`${data.bonus.toLocaleString()} bonus shows additional compensation`)
    } else {
      improvements.push('No signing bonus mentioned - could be negotiated')
      negotiationPriorities.push('Ask for $8,000-$15,000 signing bonus')
    }
    
    // Analyze equity
    if (data.equity !== '0%') {
      strengths.push('Equity package shows long-term investment opportunity')
    } else {
      improvements.push('No equity mentioned - consider asking about stock options')
    }
    
    // Analyze benefits
    if (data.benefits.length > 3) {
      strengths.push('Comprehensive benefits package included')
    } else {
      improvements.push('Benefits package could be enhanced')
      negotiationPriorities.push('Clarify and negotiate additional benefits')
    }
    
    // Remote work check
    if (!data.benefits.some((b: string) => b.toLowerCase().includes('remote'))) {
      negotiationPriorities.push('Discuss remote work policy and flexibility')
    }
    
    return {
      ...data,
      strengths,
      improvements,
      negotiationPriorities,
      offerScore: salaryPercentile > 0.7 ? 8 : salaryPercentile > 0.5 ? 7 : 6
    }
  }

  // Helper functions to extract information from ChatGPT analysis
  const extractStrengthsFromAnalysis = (analysisText: string): string[] => {
    const strengthsSection = analysisText.match(/(?:strengths|positive aspects|what.*good)([\s\S]*?)(?=areas for improvement|weaknesses|negotiation|$)/i)
    if (strengthsSection) {
      const lines = strengthsSection[1].split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      return lines.map(line => line.replace(/^[-\d.]\s*/, '').trim()).filter(line => line.length > 10).slice(0, 4)
    }
    return ['Competitive base salary package', 'Professional opportunity with growth potential']
  }

  const extractImprovementsFromAnalysis = (analysisText: string): string[] => {
    const improvementsSection = analysisText.match(/(?:areas for improvement|weaknesses|challenges)([\s\S]*?)(?=negotiation|strategies|$)/i)
    if (improvementsSection) {
      const lines = improvementsSection[1].split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      return lines.map(line => line.replace(/^[-\d.]\s*/, '').trim()).filter(line => line.length > 10).slice(0, 4)
    }
    return ['Consider negotiating additional compensation elements']
  }

  const confirmExtractedData = async () => {
    // Make sure baseSalary is set from our input
    const dataToAnalyze = {
      ...extractedData,
      baseSalary: baseSalaryInput ? Number(baseSalaryInput) : extractedData.baseSalary
    }
    
    const fullAnalysis = await generateAnalysis(dataToAnalyze)
    setAnalysis(fullAnalysis)
    setExtractedData(null)
    setIsEditingData(false)
  }

  const editExtractedData = (field: string, value: any) => {
    setExtractedData({
      ...extractedData,
      [field]: value
    })
  }

  // Format time utility
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Start session timer
  const startSessionTimer = () => {
    console.log('⏰ Session timer started')
    const startTime = Date.now()
    sessionTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setTotalSessionTime(elapsed)
    }, 1000)
  }
  
  const startTurnTimer = () => {
    console.log('⏰ Turn timer started')
    const startTime = Date.now()
    turnTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setCurrentTurnTime(elapsed)
    }, 1000)
  }
  
  const stopTurnTimer = () => {
    console.log('⏰ Turn timer stopped')
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }
    const turnTime = currentTurnTime
    setCurrentTurnTime(0)
    return turnTime
  }

  // Stop session timer
  const stopSessionTimer = (): number => {
    console.log('⏰ Session timer stopped')
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
    return totalSessionTime
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-green-600 hover:text-green-800 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Negotiation Coach
          </h1>
          <p className="text-lg text-gray-600">
            Master salary negotiation with AI-powered coaching
          </p>
        </div>

        {/* Feature Selection */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choose Your Practice Mode</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <button
                onClick={() => setMode('analysis')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  mode === 'analysis'
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-gray-200 hover:border-green-300 text-gray-700'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-2">📋 Offer Analysis</h3>
                  <p className="text-sm">Upload your offer letter and get personalized negotiation strategy</p>
                </div>
              </button>

              <button
                onClick={() => setMode('email')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  mode === 'email'
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 hover:border-blue-300 text-gray-700'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-2">✉️ Email Practice</h3>
                  <p className="text-sm">Practice negotiation emails with live AI responses</p>
                </div>
              </button>

              <button
                onClick={() => setMode('voice')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  mode === 'voice'
                    ? 'border-purple-500 bg-purple-50 text-purple-800'
                    : 'border-gray-200 hover:border-purple-300 text-gray-700'
                }`}
              >
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-2">🎙️ Voice Practice</h3>
                  <p className="text-sm">Practice live phone/video negotiation conversations</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Render content based on selected mode */}
        {mode === 'analysis' && (
          <>
            {/* Existing offer analysis content */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Input */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Step 1: Share Your Offer
                </h2>

                {/* Input Method Toggle */}
                <div className="mb-6">
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setInputMethod('file')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        inputMethod === 'file' 
                          ? 'bg-white text-green-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      📎 Upload File
                    </button>
                    <button
                      onClick={() => setInputMethod('text')}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        inputMethod === 'text' 
                          ? 'bg-white text-green-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      📝 Paste & Extract
                    </button>
                    <button
                      onClick={() => {
                        setInputMethod('manual')
                        setBaseSalaryInput('')
                        // Pre-populate with default structure for manual entry
                        setExtractedData({
                          position: '',
                          company: '',
                          baseSalary: '',
                          marketRange: { min: 0, max: 0 },
                          equity: '0%',
                          bonus: 0,
                          benefits: [],
                          rawText: 'Manual entry - no original text'
                        })
                        setIsEditingData(true)
                      }}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        inputMethod === 'manual' 
                          ? 'bg-white text-green-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      ✏️ Enter Manually
                    </button>
                  </div>
                </div>

                {inputMethod === 'file' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Offer Letter
                      </label>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG (max 10MB)
                      </p>
                      {offerFile && (
                        <p className="text-sm text-green-600 mt-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          File selected: {offerFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                ) : inputMethod === 'text' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Paste Offer Letter Text
                      </label>
                      <textarea
                        value={offerText}
                        onChange={(e) => setOfferText(e.target.value)}
                        placeholder="Paste your offer letter text here...&#10;&#10;Example:&#10;Dear John,&#10;&#10;We are pleased to offer you the position of Senior Software Engineer at TechCorp Inc.&#10;&#10;Your annual base salary will be $150,000, with a signing bonus of $10,000..."
                        rows={12}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        🤖 <strong>Smart Extraction:</strong> We'll automatically extract salary, bonus, equity, and benefits from your text, then let you review and edit the details before analysis.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <h3 className="font-medium text-blue-800">Direct Input Mode</h3>
                      </div>
                      <p className="text-sm text-blue-700">
                        ✏️ <strong>Manual Control:</strong> Enter your offer details directly using the form below. Perfect if you prefer structured input or don't have a digital offer letter to paste.
                      </p>
                    </div>
                  </div>
                )}

                {inputMethod !== 'manual' && (
                  <button
                    onClick={analyzeOffer}
                    disabled={isAnalyzing || (!offerFile && !offerText.trim())}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center mt-6"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing Offer...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Extract & Review Details
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Right Column - Analysis */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Step 2: Analysis & Strategy
                </h2>

                {!extractedData && !analysis ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600">
                      Upload or paste your offer letter to get started with personalized analysis and negotiation strategies.
                    </p>
                  </div>
                ) : extractedData ? (
                  <div className="space-y-6">
                    {/* Extracted Data Review */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-green-800 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {inputMethod === 'manual' ? 'Enter Your Offer Details' : 'Review & Edit Extracted Information'}
                          </h3>
                          <p className="text-sm text-green-700 mt-1">
                            {inputMethod === 'manual' 
                              ? 'Fill in your offer details below, then generate your negotiation strategy.'
                              : 'We\'ve extracted key details from your offer. Please review and edit any information before generating your strategy.'
                            }
                          </p>
                        </div>
                        {inputMethod !== 'manual' && (
                          <button
                            onClick={() => setIsEditingData(!isEditingData)}
                            className="flex items-center text-sm text-green-600 hover:text-green-800 bg-white px-3 py-2 rounded-lg border border-green-300 hover:border-green-500 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {isEditingData ? 'Done Editing' : 'Edit Details'}
                          </button>
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Left Column - Basic Info */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Position/Job Title *
                            </label>
                            <input
                              type="text"
                              value={extractedData.position}
                              onChange={(e) => editExtractedData('position', e.target.value)}
                              placeholder="e.g., Senior Software Engineer"
                              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              disabled={inputMethod !== 'manual' && !isEditingData}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Company Name *
                            </label>
                            <input
                              type="text"
                              value={extractedData.company}
                              onChange={(e) => editExtractedData('company', e.target.value)}
                              placeholder="e.g., TechCorp Inc"
                              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              disabled={inputMethod !== 'manual' && !isEditingData}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Base Salary (Annual) *
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-3 text-gray-500">$</span>
                              <input
                                type="text"
                                value={baseSalaryInput}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9]/g, '')
                                  setBaseSalaryInput(value)
                                  // Also update extractedData if it exists
                                  if (extractedData) {
                                    editExtractedData('baseSalary', value)
                                    // Auto-update market range if salary has value
                                    if (value && !isNaN(Number(value))) {
                                      const salaryNum = Number(value)
                                      editExtractedData('marketRange', {
                                        min: Math.round(salaryNum * 0.85),
                                        max: Math.round(salaryNum * 1.25)
                                      })
                                    }
                                  }
                                }}
                                placeholder="150000"
                                className="w-full pl-8 pr-3 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Enter annual salary without commas</p>
                          </div>
                        </div>

                        {/* Right Column - Additional Compensation */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Signing Bonus
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-3 text-gray-500">$</span>
                              <input
                                type="number"
                                value={extractedData.bonus || ''}
                                onChange={(e) => editExtractedData('bonus', parseInt(e.target.value) || 0)}
                                placeholder="10000"
                                className="w-full pl-8 pr-3 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                disabled={inputMethod !== 'manual' && !isEditingData}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Leave blank if no signing bonus</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Equity/Stock Options
                            </label>
                            <input
                              type="text"
                              value={extractedData.equity}
                              onChange={(e) => editExtractedData('equity', e.target.value)}
                              placeholder="0.5% or $50,000 worth"
                              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              disabled={inputMethod !== 'manual' && !isEditingData}
                            />
                            <p className="text-xs text-gray-500 mt-1">Enter as percentage (e.g., 0.5%) or dollar value</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Benefits & Perks
                            </label>
                            <div className="space-y-2">
                              {['Health Insurance', 'Dental Insurance', 'Vision Insurance', '401k Match', 'PTO', 'Remote Work', 'Flexible Schedule', 'Life Insurance'].map((benefit) => (
                                <label key={benefit} className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={extractedData.benefits.includes(benefit)}
                                    onChange={(e) => {
                                      const currentBenefits = extractedData.benefits || []
                                      if (e.target.checked) {
                                        editExtractedData('benefits', [...currentBenefits, benefit])
                                      } else {
                                        editExtractedData('benefits', currentBenefits.filter((b: string) => b !== benefit))
                                      }
                                    }}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    disabled={inputMethod !== 'manual' && !isEditingData}
                                  />
                                  <span className="ml-2 text-sm text-gray-700">{benefit}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Market Range Display */}
                      {extractedData.baseSalary && Number(extractedData.baseSalary) > 0 && (
                        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                          <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
                            </svg>
                            Estimated Market Range
                          </h4>
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center">
                              <span className="text-gray-600">Min:</span>
                              <span className="ml-1 font-medium">${extractedData.marketRange?.min?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-600">Max:</span>
                              <span className="ml-1 font-medium">${extractedData.marketRange?.max?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-gray-600">Your Offer:</span>
                              <span className="ml-1 font-bold text-green-600">${Number(extractedData.baseSalary)?.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Raw Text Preview - Only for extracted data */}
                      {inputMethod !== 'manual' && extractedData.rawText && extractedData.rawText !== 'Manual entry - no original text' && (
                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <details className="group">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center">
                              <svg className="w-4 h-4 mr-2 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                              View Original Text
                            </summary>
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                              {extractedData.rawText.substring(0, 1000)}{extractedData.rawText.length > 1000 ? '...' : ''}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <span className="text-red-500">*</span> Required fields
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            setExtractedData(null)
                            setOfferText('')
                            setOfferFile(null)
                            setInputMethod('file')
                            setIsEditingData(false)
                          }}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                        >
                          Start Over
                        </button>
                        <button
                          onClick={confirmExtractedData}
                          disabled={!extractedData.position || !extractedData.company || !baseSalaryInput || isGeneratingAnalysis}
                          className="bg-green-600 text-white py-2 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                        >
                          {isGeneratingAnalysis ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating Analysis...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Generate Negotiation Strategy
                            </>
                          )}
                        </button>
                      </div>
                      {analysisError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                          <div className="flex">
                            <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <strong>Analysis Error:</strong> {analysisError}
                              <br />
                              <span className="text-red-600">Don't worry - we've generated a basic analysis for you to get started.</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Offer Summary */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-green-800">Offer Summary</h3>
                        {analysis.offerScore && (
                          <div className="flex items-center">
                            <span className="text-sm text-gray-600 mr-2">AI Score:</span>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                              analysis.offerScore >= 8 ? 'bg-green-100 text-green-800' :
                              analysis.offerScore >= 6 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {analysis.offerScore}/10
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Position:</span>
                          <p className="font-medium">{analysis.position}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Company:</span>
                          <p className="font-medium">{analysis.company}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Base Salary:</span>
                          <p className="font-medium">${analysis.baseSalary.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Market Range:</span>
                          <p className="font-medium">${analysis.marketRange.min.toLocaleString()} - ${analysis.marketRange.max.toLocaleString()}</p>
                        </div>
                      </div>
                      {analysis.chatgptAnalysis && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <div className="flex items-center text-sm text-green-700">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span className="font-medium">Enhanced AI Analysis Provided</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Strengths */}
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Offer Strengths
                      </h3>
                      <ul className="space-y-2">
                        {analysis.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-green-500 mr-2">•</span>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas for Improvement */}
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                        <svg className="w-5 h-5 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Areas for Improvement
                      </h3>
                      <ul className="space-y-2">
                        {analysis.improvements.map((improvement: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-orange-500 mr-2">•</span>
                            {improvement}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Negotiation Priorities */}
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                        <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Negotiation Priorities
                      </h3>
                      <ul className="space-y-2">
                        {analysis.negotiationPriorities.map((priority: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-blue-500 mr-2 font-bold">{index + 1}.</span>
                            {priority}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={() => setMode('email')}
                        className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Start Email Practice
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {mode === 'email' && (
          <EmailPracticeMode 
            analysis={analysis}
            emailThread={emailThread}
            setEmailThread={setEmailThread}
            currentEmailDraft={currentEmailDraft}
            setCurrentEmailDraft={setCurrentEmailDraft}
            isEmailPracticeActive={isEmailPracticeActive}
            setIsEmailPracticeActive={setIsEmailPracticeActive}
          />
        )}

        {mode === 'voice' && (
          <VoicePracticeMode 
            analysis={analysis}
            isVoicePracticeActive={isVoicePracticeActive}
            setIsVoicePracticeActive={setIsVoicePracticeActive}
            voiceScenario={voiceScenario}
            setVoiceScenario={setVoiceScenario}
          />
        )}
      </div>
    </div>
  )
}

// Email Practice Component
function EmailPracticeMode({ 
  analysis, 
  emailThread, 
  setEmailThread, 
  currentEmailDraft, 
  setCurrentEmailDraft,
  isEmailPracticeActive,
  setIsEmailPracticeActive 
}: any) {
  const [conversationAnalysis, setConversationAnalysis] = useState<any>(null)
  const [emailFeedback, setEmailFeedback] = useState<any>(null)
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Quick start email templates
  const emailTemplates = [
    {
      id: 'salary_increase',
      title: 'Request Salary Increase',
      template: `Dear Sarah,

Thank you for the generous offer for the ${analysis?.position || '[Position]'} role at ${analysis?.company || '[Company]'}. I'm very excited about the opportunity to contribute to your team.

After reviewing the offer details and researching market rates for similar positions, I would like to discuss the base salary. Based on my experience and the current market range of $${analysis?.marketRange?.min?.toLocaleString() || '[Min]'} - $${analysis?.marketRange?.max?.toLocaleString() || '[Max]'}, I was hoping we could adjust the base salary to $${Math.round((analysis?.marketRange?.max || 170000) * 0.95)?.toLocaleString() || '[Target Amount]'}.

I believe this adjustment would better reflect the value I bring to the role and align with industry standards. I'm confident I can make a significant impact on your team and would love to discuss this further.

Looking forward to your thoughts.

Best regards,
[Your Name]`
    },
    {
      id: 'signing_bonus',
      title: 'Request Signing Bonus',
      template: `Dear Sarah,

Thank you for the offer for the ${analysis?.position || '[Position]'} position. I'm thrilled about the opportunity to join ${analysis?.company || '[Company]'} and contribute to the team's success.

I wanted to discuss the possibility of including a signing bonus in the compensation package. Given the transition costs and the immediate value I'll bring to the role, I was hoping we could include a $10,000 signing bonus.

This would help offset the costs associated with transitioning to a new role and demonstrate the company's investment in bringing me aboard. I'm very excited about this opportunity and believe we can find a mutually beneficial arrangement.

I look forward to hearing your thoughts.

Best regards,
[Your Name]`
    },
    {
      id: 'benefits_discussion',
      title: 'Discuss Benefits Package',
      template: `Dear Sarah,

Thank you for the comprehensive offer for the ${analysis?.position || '[Position]'} role. I'm excited about the opportunity to join ${analysis?.company || '[Company]'}.

I'd like to discuss a few aspects of the benefits package to better understand the full compensation structure:

• Remote work policy and flexibility
• Professional development budget
• Additional PTO or flexible time off
• Health insurance coverage details

These benefits are important to me as they contribute to work-life balance and professional growth. I'd appreciate the opportunity to discuss how we might enhance the package in these areas.

Thank you for your time and consideration.

Best regards,
[Your Name]`
    },
    {
      id: 'multiple_requests',
      title: 'Multiple Negotiation Points',
      template: `Dear Sarah,

Thank you for the offer for the ${analysis?.position || '[Position]'} position at ${analysis?.company || '[Company]'}. I'm genuinely excited about this opportunity and the chance to contribute to your team.

After careful consideration, I'd like to discuss a few aspects of the offer:

1. Base Salary: Based on market research showing a range of $${analysis?.marketRange?.min?.toLocaleString() || '[Min]'} - $${analysis?.marketRange?.max?.toLocaleString() || '[Max]'}, I'd like to discuss adjusting to $${Math.round((analysis?.marketRange?.max || 170000) * 0.9)?.toLocaleString() || '[Target]'}

2. Signing Bonus: A $8,000 signing bonus to help with transition costs

3. Start Date: Flexibility to start in 3-4 weeks to ensure a smooth transition from my current role

I believe these adjustments would create a package that reflects both the market value and my enthusiasm for the role. I'm confident we can find a solution that works for both parties.

I'd welcome the opportunity to discuss this further at your convenience.

Best regards,
[Your Name]`
    }
  ]

  const selectTemplate = (template: string) => {
    setCurrentEmailDraft(template)
  }

  const startEmailPractice = () => {
    if (!analysis) {
      alert('Please analyze your offer first to get personalized practice scenarios')
      return
    }
    setIsEmailPracticeActive(true)
    setConversationAnalysis(null)
    // Initialize with a scenario email from the "hiring manager"
    setEmailThread([{
      id: 1,
      sender: 'hiring_manager',
      subject: `Re: ${analysis.position} Offer`,
      content: `Hi there,\n\nThanks for your interest in discussing the offer details. I have some time this week to go over any questions you might have about the compensation package.\n\nWhat specific aspects would you like to discuss?\n\nBest regards,\nSarah Johnson\nHiring Manager`,
      timestamp: new Date().toISOString()
    }])
  }

  const sendEmail = async () => {
    if (!currentEmailDraft.trim()) return

    // Add user's email to thread
    const userEmail = {
      id: emailThread.length + 1,
      sender: 'user',
      subject: `Re: ${analysis?.position || 'Position'} Offer`,
      content: currentEmailDraft,
      timestamp: new Date().toISOString()
    }
    
    setEmailThread([...emailThread, userEmail])
    setCurrentEmailDraft('')

    // Simulate AI response after a delay
    setTimeout(() => {
      const aiResponse = {
        id: emailThread.length + 2,
        sender: 'hiring_manager',
        subject: `Re: ${analysis?.position || 'Position'} Offer`,
        content: generateAIResponse(currentEmailDraft, analysis),
        timestamp: new Date().toISOString()
      }
      setEmailThread((prev: EmailMessage[]) => [...prev, aiResponse])
      
      // Trigger conversation analysis after AI responds
      analyzeConversation([...emailThread, userEmail, aiResponse])
    }, 2000)
  }

  const analyzeConversation = (thread: EmailMessage[]) => {
    if (thread.length < 2) return
    
    setIsAnalyzing(true)
    
    // Mock AI analysis of the conversation
    setTimeout(() => {
      const userEmails = thread.filter(email => email.sender === 'user')
      const lastUserEmail = userEmails[userEmails.length - 1]
      
      const mockAnalysis = {
        overallTone: determineOverallTone(lastUserEmail?.content || ''),
        strengths: analyzeStrengths(lastUserEmail?.content || ''),
        improvements: analyzeImprovements(lastUserEmail?.content || ''),
        negotiationEffectiveness: calculateEffectiveness(lastUserEmail?.content || ''),
        nextSteps: suggestNextSteps(lastUserEmail?.content || '', thread.length)
      }
      
      setConversationAnalysis(mockAnalysis)
      setIsAnalyzing(false)
    }, 1500)
  }

  const determineOverallTone = (content: string) => {
    if (content.toLowerCase().includes('thank you') && content.toLowerCase().includes('appreciate')) {
      return { score: 'Professional', color: 'text-green-600', description: 'Polite and respectful tone' }
    } else if (content.toLowerCase().includes('need') || content.toLowerCase().includes('require')) {
      return { score: 'Direct', color: 'text-blue-600', description: 'Clear and assertive communication' }
    } else {
      return { score: 'Neutral', color: 'text-gray-600', description: 'Balanced approach' }
    }
  }

  const analyzeStrengths = (content: string) => {
    const strengths = []
    if (content.toLowerCase().includes('research') || content.toLowerCase().includes('market')) {
      strengths.push('Backed requests with market research')
    }
    if (content.toLowerCase().includes('thank') || content.toLowerCase().includes('appreciate')) {
      strengths.push('Maintained professional and grateful tone')
    }
    if (content.toLowerCase().includes('specific') || content.includes('$')) {
      strengths.push('Made specific, quantified requests')
    }
    if (content.toLowerCase().includes('value') || content.toLowerCase().includes('contribute')) {
      strengths.push('Emphasized value proposition')
    }
    return strengths.length > 0 ? strengths : ['Clear communication']
  }

  const analyzeImprovements = (content: string) => {
    const improvements = []
    if (!content.toLowerCase().includes('thank') && !content.toLowerCase().includes('appreciate')) {
      improvements.push('Consider starting with gratitude for the offer')
    }
    if (!content.includes('$') && !content.toLowerCase().includes('salary') && !content.toLowerCase().includes('compensation')) {
      improvements.push('Be more specific about compensation requests')
    }
    if (!content.toLowerCase().includes('research') && !content.toLowerCase().includes('market')) {
      improvements.push('Reference market research to support requests')
    }
    if (content.length < 100) {
      improvements.push('Provide more context and justification for requests')
    }
    return improvements.length > 0 ? improvements : ['Consider adding more specific examples of your value']
  }

  const calculateEffectiveness = (content: string) => {
    let score = 60 // Base score
    if (content.toLowerCase().includes('thank')) score += 10
    if (content.toLowerCase().includes('market') || content.toLowerCase().includes('research')) score += 15
    if (content.includes('$')) score += 10
    if (content.toLowerCase().includes('value') || content.toLowerCase().includes('contribute')) score += 10
    if (content.length > 150) score += 5
    
    return Math.min(score, 95) // Cap at 95%
  }

  const suggestNextSteps = (content: string, threadLength: number) => {
    if (threadLength <= 3) {
      return ['Wait for their response and be prepared to provide specific examples', 'Research comparable salaries to strengthen your position']
    } else if (threadLength <= 5) {
      return ['Consider scheduling a call to discuss details', 'Be prepared to negotiate on multiple aspects (salary, benefits, start date)']
    } else {
      return ['Work toward finalizing the agreement', 'Get any verbal agreements in writing']
    }
  }

  const generateAIResponse = (userEmail: string, offerAnalysis: any) => {
    // Mock AI response generation based on user's email content
    if (userEmail.toLowerCase().includes('salary')) {
      return `Thank you for bringing up the salary discussion. I understand you're looking for an adjustment to the base salary. \n\nLet me review this with the team and see what flexibility we have. Can you share what range you had in mind based on your research?\n\nI'll get back to you by end of week with an update.\n\nBest,\nSarah`
    } else if (userEmail.toLowerCase().includes('benefits')) {
      return `I appreciate you highlighting the benefits package. We do have some flexibility in certain areas.\n\nCould you let me know which specific benefits are most important to you? This will help me understand how we can best structure the package.\n\nLooking forward to your thoughts.\n\nBest regards,\nSarah Johnson`
    } else if (userEmail.toLowerCase().includes('timeline') || userEmail.toLowerCase().includes('start date')) {
      return `Thanks for bringing up the timeline. We're flexible on the start date within reason.\n\nWhat timeframe works best for you? We'd ideally like to have you start within the next 4-6 weeks, but we can discuss options.\n\nBest,\nSarah`
    }
    return `Thanks for your email. I appreciate you taking the time to share your thoughts. Let me discuss this internally and get back to you with next steps.\n\nBest regards,\nSarah Johnson`
  }

  const generateEmailFeedback = async (emailThread: any[]) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Generate email feedback' }],
          feedbackType: 'email',
          emailThread: emailThread
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate feedback')
      }

      const data = await response.json()
      return data.feedback
    } catch (error) {
      console.error('Error generating email feedback:', error)
      // Return default feedback if API fails
      return {
        overallScore: 7,
        strengths: [
          "Professional communication style",
          "Clear structure and organization",
          "Appropriate tone for business context"
        ],
        areasForImprovement: [
          "Could provide more specific examples",
          "Consider adding supporting evidence",
          "Timing of follow-up could be optimized"
        ],
        nextSteps: [
          "Follow up professionally within 2-3 business days",
          "Prepare additional supporting materials",
          "Consider scheduling a call to discuss details"
        ],
        keyInsights: [
          "Written communication requires careful attention to tone",
          "Preparation and research strengthen your position"
        ]
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Email Negotiation Practice</h2>
        
        {!isEmailPracticeActive ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Practice Email Negotiations</h3>
            <p className="text-gray-600 mb-6">
              Engage in realistic email exchanges with an AI hiring manager. Perfect your written negotiation skills in a safe environment.
            </p>
            <button
              onClick={startEmailPractice}
              className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Email Practice
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Email Composer */}
            <div className="border rounded-lg bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <div className="text-sm font-medium text-gray-700">Compose New Message</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-12 gap-2 text-sm">
                  <div className="col-span-1 text-gray-600 font-medium pt-2">To:</div>
                  <div className="col-span-11 pt-2 text-gray-800">sarah.johnson@techcorp.com</div>
                </div>
                <div className="grid grid-cols-12 gap-2 text-sm">
                  <div className="col-span-1 text-gray-600 font-medium pt-2">Subject:</div>
                  <div className="col-span-11 pt-2 text-gray-800">Re: {analysis?.position || 'Position'} Offer</div>
                </div>
                
                {/* Quick Start Templates */}
                {analysis && (
                  <div className="border-t pt-3">
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Quick Start Templates:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {emailTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => selectTemplate(template.template)}
                            className="p-2 text-xs text-left rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div className="font-medium text-blue-600">{template.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="border-t pt-3">
                  <textarea
                    value={currentEmailDraft}
                    onChange={(e) => setCurrentEmailDraft(e.target.value)}
                    placeholder="Dear Sarah,&#10;&#10;Thank you for the offer for the [Position] role. I'm excited about the opportunity to join the team.&#10;&#10;After reviewing the details, I'd like to discuss..."
                    rows={10}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-500 flex items-center">
                    <svg className="w-4 h-4 mr-1 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Tips: Be professional, specific, and back up requests with research
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentEmailDraft('')}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Clear
                    </button>
                    <div className="flex gap-2">
                    <button
                      onClick={sendEmail}
                      disabled={!currentEmailDraft.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send Email
                    </button>
                      <button
                        onClick={() => setIsEmailPracticeActive(false)}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        End Practice
                      </button>
                      {emailThread.length >= 2 && (
                        <button
                          onClick={async () => {
                            setIsGeneratingFeedback(true)
                            const feedback = await generateEmailFeedback(emailThread)
                            setEmailFeedback(feedback)
                            setIsGeneratingFeedback(false)
                          }}
                          disabled={isGeneratingFeedback}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingFeedback ? 'Generating...' : 'Get AI Feedback'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Conversation Analysis */}
      {emailThread.length > 1 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">AI Conversation Analysis</h3>
            {isAnalyzing && (
              <div className="flex items-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Analyzing...
              </div>
            )}
          </div>

          {conversationAnalysis ? (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">Negotiation Effectiveness</h4>
                  <div className="text-2xl font-bold text-green-600">
                    {conversationAnalysis.negotiationEffectiveness}%
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${conversationAnalysis.negotiationEffectiveness}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Tone Analysis */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Communication Tone
                  </h4>
                  <div className={`text-lg font-medium ${conversationAnalysis.overallTone.color} mb-1`}>
                    {conversationAnalysis.overallTone.score}
                  </div>
                  <p className="text-sm text-gray-600">{conversationAnalysis.overallTone.description}</p>
                </div>

                {/* Next Steps */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Recommended Next Steps
                  </h4>
                  <ul className="space-y-1">
                    {conversationAnalysis.nextSteps.map((step: string, index: number) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-purple-500 mr-2 font-bold">{index + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Strengths and Improvements */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    What You Did Well
                  </h4>
                  <ul className="space-y-2">
                    {conversationAnalysis.strengths.map((strength: string, index: number) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Areas to Improve
                  </h4>
                  <ul className="space-y-2">
                    {conversationAnalysis.improvements.map((improvement: string, index: number) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-orange-500 mr-2">→</span>
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : emailThread.length > 1 && !isAnalyzing ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-600">Send your first negotiation email to get AI analysis and feedback on your approach.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Email AI Feedback Section */}
      {emailFeedback && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-800 flex items-center">
              🤖 Email Negotiation Analysis
            </h4>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Overall Score:</span>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                emailFeedback.overallScore >= 8 ? 'bg-green-100 text-green-800' :
                emailFeedback.overallScore >= 6 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {emailFeedback.overallScore}/10
              </div>
            </div>
          </div>

          {/* Strengths and Areas for Improvement */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h5 className="font-semibold text-green-800 mb-3 flex items-center">
                ✅ Strengths
              </h5>
              <ul className="space-y-2">
                {emailFeedback.strengths?.map((strength: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-green-600 mr-2 mt-1">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg p-4 border border-orange-200">
              <h5 className="font-semibold text-orange-800 mb-3 flex items-center">
                🎯 Areas for Improvement
              </h5>
              <ul className="space-y-2">
                {emailFeedback.areasForImprovement?.map((improvement: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-orange-600 mr-2 mt-1">•</span>
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-semibold text-blue-800 mb-3 flex items-center">
              🚀 Your Next Steps
            </h5>
            <ul className="space-y-2">
              {emailFeedback.nextSteps.map((step: string, index: number) => (
                <li key={index} className="text-sm text-gray-700 flex items-start">
                  <span className="text-blue-600 mr-2 mt-1">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Insights */}
          {emailFeedback.keyInsights && emailFeedback.keyInsights.length > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
              <h5 className="font-semibold text-purple-800 mb-3 flex items-center">
                💡 Key Insights
              </h5>
              <ul className="space-y-2">
                {emailFeedback.keyInsights.map((insight: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-purple-600 mr-2 mt-1">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setEmailFeedback(null)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              Close Feedback
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// Voice Practice Component  
function VoicePracticeMode({
  analysis,
  isVoicePracticeActive,
  setIsVoicePracticeActive,
  voiceScenario,
  setVoiceScenario
}: any) {
  // Add all missing state variables and refs
  const [isHiringManagerSpeaking, setIsHiringManagerSpeaking] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [liveKitToken, setLiveKitToken] = useState<any>(null)
  const [liveKitRoom, setLiveKitRoom] = useState<any>(null)
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false)
  const [liveKitError, setLiveKitError] = useState<string | null>(null)
  const [isPreparingToListen, setIsPreparingToListen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [sessionSummary, setSessionSummary] = useState<any>(null)
  
  // Add all missing refs
  const hiringManagerSpeakingRef = useRef(false)
  const isListeningRef = useRef(false)
  const sessionStartedRef = useRef(false)
  
  // Add missing timer functions
  const startSessionTimer = () => {
    console.log('⏰ Session timer started')
    const startTime = Date.now()
    sessionTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setTotalSessionTime(elapsed)
    }, 1000)
  }

  const startTurnTimer = () => {
    console.log('⏰ Turn timer started')
    const startTime = Date.now()
    turnTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setCurrentTurnTime(elapsed)
    }, 1000)
  }

  const stopTurnTimer = () => {
    console.log('⏰ Turn timer stopped')
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }
    const turnTime = currentTurnTime
    setCurrentTurnTime(0)
    return turnTime
  }
  
  // Add missing recording state and refs
  const [isRecording, setIsRecording] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const recognitionRef = useRef<any>(null)
  const maxRecordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Add missing refs and state variables for timers and session management
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingResponseRef = useRef(false)
  const lastResponseKeyRef = useRef<string>('')
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [totalSessionTime, setTotalSessionTime] = useState(0)
  const [currentTurnTime, setCurrentTurnTime] = useState(0)
  const [negotiationFocus, setNegotiationFocus] = useState<string[]>([])
  
  // Add missing functions
  const stopSessionTimer = (): number => {
    console.log('⏰ Session timer stopped')
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
    return totalSessionTime
  }
  
  // Add formatTime function for VoicePracticeMode
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // New negotiation outcome tracking
  const [negotiationOutcome, setNegotiationOutcome] = useState<{
    originalSalary: number
    finalSalary: number
    percentIncrease: number
    dollarIncrease: number
    otherBenefits: string[]
    negotiationStatus: 'in_progress' | 'successful' | 'unsuccessful' | 'ended'
  }>({
    originalSalary: analysis?.salaryInfo?.base || 0,
    finalSalary: analysis?.salaryInfo?.base || 0,
    percentIncrease: 0,
    dollarIncrease: 0,
    otherBenefits: [],
    negotiationStatus: 'in_progress'
  })

  const [targetSalary, setTargetSalary] = useState(0)
  const [showOutcomeInput, setShowOutcomeInput] = useState(false)

  const scenarios = [
    {
      id: 'total_compensation',
      title: 'Total Compensation',
      description: 'Practice negotiating overall compensation package including salary, bonus, and equity',
      category: 'Compensation',
      goal: 'Secure market-competitive total compensation with balanced mix of base, bonus, and equity',
      strategy: 'Focus on total package value, market research, performance incentives, and long-term wealth building'
    },
    {
      id: 'benefits',
      title: 'Benefits',
      description: 'Negotiate comprehensive benefits including health, retirement, PTO, and professional development',
      category: 'Benefits',
      goal: 'Secure enhanced benefits package with improved health coverage, retirement matching, and professional development budget',
      strategy: 'Emphasize family needs, health priorities, retirement planning, work-life balance, and career growth'
    },
    {
      id: 'general_practice',
      title: 'General Practice',
      description: 'Open-ended negotiation practice covering multiple aspects of the offer',
      category: 'General',
      goal: 'Practice comprehensive negotiation skills across various offer components',
      strategy: 'Be flexible, prioritize requests, find creative solutions, and maintain positive relationship throughout'
    }
  ]

  // Available negotiation focuses based on offer analysis (removed base_salary)
  const availableNegotiationFoci = [
    {
      id: 'signing_bonus',
      label: 'Signing Bonus',
      description: `Current: ${analysis?.bonus ? `$${analysis.bonus.toLocaleString()}` : 'Not included'}`,
      suggested: !analysis?.bonus || analysis.bonus < 10000
    },
    {
      id: 'equity_stock',
      label: 'Equity/Stock Options',
      description: `Current: ${analysis?.equity || 'Not specified'}`,
      suggested: !analysis?.equity || analysis.equity === '0%'
    },
    {
      id: 'benefits_package',
      label: 'Benefits Package',
      description: `Current: ${analysis?.benefits?.length || 0} benefits listed`,
      suggested: !analysis?.benefits || analysis.benefits.length < 4
    },
    {
      id: 'remote_flexibility',
      label: 'Remote Work/Flexibility',
      description: 'Work location and schedule flexibility',
      suggested: !analysis?.benefits?.some((b: string) => b.toLowerCase().includes('remote'))
    },
    {
      id: 'professional_development',
      label: 'Professional Development',
      description: 'Training, conferences, and growth opportunities',
      suggested: true
    },
    {
      id: 'vacation_pto',
      label: 'Vacation/PTO',
      description: 'Additional time off and holiday policies',
      suggested: false
    },
    {
      id: 'start_date',
      label: 'Start Date',
      description: 'Timeline and transition planning',
      suggested: false
    }
  ]

  // Keep refs in sync with state
  useEffect(() => {
    hiringManagerSpeakingRef.current = isHiringManagerSpeaking
  }, [isHiringManagerSpeaking])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    sessionStartedRef.current = sessionStarted
  }, [sessionStarted])

  // Initialize LiveKit connection
  useEffect(() => {
    if (isVoicePracticeActive && !liveKitToken) {
      initializeLiveKit()
    }
  }, [isVoicePracticeActive])

  // Session Analytics State and Functions
  const [sessionAnalytics, setSessionAnalytics] = useState({
    totalFillerWords: 0,
    responseCount: 0,
    avgResponseTime: 0,
    responses: [] as Array<{
      text: string,
      timestamp: number,
      fillerCount: number,
      duration: number
    }>
  })

  const countFillerWords = (text: string): number => {
    const fillers = ["um", "uh", "like", "you know", "so", "actually", "basically", "literally", "i mean", "sort of", "kind of"]
    const lowerText = text.toLowerCase()
    return fillers.reduce((acc, word) => {
      const regex = new RegExp(`\\b${word}\\b`, "gi")
      const matches = lowerText.match(regex) || []
      return acc + matches.length
    }, 0)
  }

  const updateSessionAnalytics = (userMessage: string, duration: number) => {
    const fillerCount = countFillerWords(userMessage)
    const timestamp = Date.now()
    
    setSessionAnalytics(prev => {
      const newResponses = [...prev.responses, {
        text: userMessage,
        timestamp,
        fillerCount,
        duration
      }]
      
      const newTotalFillers = prev.totalFillerWords + fillerCount
      const newResponseCount = prev.responseCount + 1
      const totalDuration = newResponses.reduce((sum, r) => sum + r.duration, 0)
      const newAvgResponseTime = totalDuration / newResponseCount
      
      return {
        totalFillerWords: newTotalFillers,
        responseCount: newResponseCount,
        avgResponseTime: newAvgResponseTime,
        responses: newResponses
      }
    })
    
    console.log('📊 Session Analytics Updated:', {
      message: userMessage.substring(0, 50) + '...',
      fillerCount,
      duration,
      totalFillers: sessionAnalytics.totalFillerWords + fillerCount
    })
  }

  const initializeLiveKit = async () => {
    try {
      const response = await fetch(`/api/livekit-token?identity=negotiation-user-${Date.now()}&room=negotiation-practice-${Date.now()}`)
      const tokenData = await response.json()
      
      if (!response.ok) {
        throw new Error(tokenData.error || 'Failed to get LiveKit token')
      }
      
      setLiveKitToken(tokenData)
      
      // Import LiveKit dynamically to avoid SSR issues
      const { Room } = await import('livekit-client')
      const room = new Room()
      
      room.on('connected', () => {
        console.log('Connected to LiveKit room')
        setIsLiveKitConnected(true)
        setLiveKitError(null)
      })
      
      room.on('disconnected', () => {
        console.log('Disconnected from LiveKit room')
        setIsLiveKitConnected(false)
      })
      
      await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880', tokenData.token)
      setLiveKitRoom(room)
      
    } catch (error) {
      console.error('LiveKit initialization error:', error)
      setLiveKitError(error instanceof Error ? error.message : 'Failed to connect to voice service')
    }
  }

  const generateInitialMessage = async (scenario: any) => {
    console.log('🤖 Generating initial message for scenario:', scenario.title)
    
    const systemPrompt = `You are a professional hiring manager starting a salary negotiation conversation. Generate a natural, welcoming opening message (30-50 words) for this specific scenario:

Scenario: ${scenario.title}
Goal: ${scenario.goal} 
Strategy: ${scenario.strategy}

Current offer details:
- Position: ${analysis?.position || 'Software Engineer'}
- Company: ${analysis?.company || 'TechCorp'}
- Base Salary: $${analysis?.baseSalary || 100000}
- Current Benefits: ${analysis?.benefits?.length || 0} listed

Create a friendly, professional opening that:
- Sets the right tone for this specific scenario
- References the relevant aspects of their offer
- Asks an engaging question to start the conversation
- Feels natural and personalized

Keep it conversational and under 50 words.`

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Generate an opening message for the ${scenario.title} negotiation scenario.`
            }
          ],
          temperature: 0.8,
          max_tokens: 150
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      const initialMessage = data.choices?.[0]?.message?.content || `Hi! I'm excited to discuss your ${scenario.title.toLowerCase()} package. What aspects are most important to you?`
      
      console.log('🤖 Generated initial message:', initialMessage.substring(0, 100) + '...')
      return initialMessage
      
    } catch (error) {
      console.error('Error generating initial message:', error)
      
      // Fallback messages based on scenario
      const fallbackMessages = {
        'Total Compensation': `Hi! I'm excited to discuss your total compensation package. What aspects of salary, bonus, and equity are most important to you?`,
        'Benefits': `Let's talk about your benefits package. What benefits matter most to you and your family?`,
        'General Practice': `Thanks for taking time to discuss your offer. What would you like to focus on today?`
      }
      
      return fallbackMessages[scenario.title as keyof typeof fallbackMessages] || 
             `Hi! I'm excited to discuss your offer. What aspects would you like to focus on?`
    }
  }

  const startVoicePractice = async () => {
    console.log('🚀 startVoicePractice called')
    console.log('📊 Current analysis:', !!analysis)
    console.log('🎯 Current voiceScenario:', voiceScenario)
    
    if (!analysis) {
      alert('Please analyze your offer first to get personalized practice scenarios')
      return
    }

    console.log('Starting voice practice...')
    
    try {
      // Request microphone permission first
      console.log('🎤 Requesting microphone permission...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('✅ Microphone permission granted')
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('❌ Microphone permission denied:', error)
      alert('Microphone access is required for voice practice. Please allow microphone access and try again.')
      return
    }
    
    // Clear any previous session summary
    setSessionSummary(null)
    
    console.log('🔄 Setting voice practice states...')
    setIsVoicePracticeActive(true)
    setSessionStarted(true)
    startSessionTimer()
    
    // Find the selected scenario or use the first one
    const selectedScenario = scenarios.find(s => s.title === voiceScenario) || scenarios[0]
    console.log('🎭 Selected scenario:', selectedScenario.title)
    
    // Generate initial message using ChatGPT
    console.log('🤖 Generating initial message with ChatGPT...')
    const initialMessageText = await generateInitialMessage(selectedScenario)
    console.log('💬 Generated initial message:', initialMessageText.substring(0, 100) + '...')
    
    // Add initial message to conversation
    const initialMessage = {
      speaker: 'hiring_manager' as const,
      message: initialMessageText,
      timestamp: new Date().toISOString(),
      duration: 0
    }
    
    console.log('📝 Adding initial message to conversation history')
    setConversationHistory([initialMessage])
    
    // Speak the initial message
    console.log('⏰ Setting timeout to speak initial message in 1 second...')
    setTimeout(() => {
      console.log('🎙️ Timeout executed, calling speakHiringManagerMessage...')
      speakHiringManagerMessage(initialMessageText)
    }, 1000)
  }

  const speakHiringManagerMessage = async (message: string) => {
    console.log('🎙️ speakHiringManagerMessage called with message:', message.substring(0, 100) + '...')
    
    // Prevent double calls if already speaking
    if (hiringManagerSpeakingRef.current) {
      console.log('⚠️ Already speaking, ignoring duplicate call')
      return
    }
    
    try {
      console.log('🔄 Setting isHiringManagerSpeaking to true')
      setIsHiringManagerSpeaking(true)
      hiringManagerSpeakingRef.current = true
      
      console.log('📡 Making TTS API request...')
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message,
          voice: 'echo'
        }),
      })

      console.log('📡 TTS API response status:', response.status, response.ok)
      
      if (!response.ok) {
        throw new Error('Failed to generate speech')
      }

      const audioBlob = await response.blob()
      console.log('🎵 Audio blob received, size:', audioBlob.size, 'bytes')
      
      // Always try to play the audio - OpenAI TTS is working
      console.log('🎵 Playing OpenAI TTS audio...')
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      // Add more audio debugging
      audio.volume = 1.0
      console.log('🔊 Audio volume set to:', audio.volume)
      console.log('🎵 Audio URL created:', audioUrl.substring(0, 50) + '...')

      audio.onended = () => {
        console.log('🎙️ OpenAI TTS audio finished playing')
        setIsHiringManagerSpeaking(false)
        hiringManagerSpeakingRef.current = false
        URL.revokeObjectURL(audioUrl)
        
        if (sessionStartedRef.current) {
          console.log('✅ Setting up listening after TTS...')
          setIsPreparingToListen(true)
          setTimeout(() => {
            if (!hiringManagerSpeakingRef.current && sessionStartedRef.current) {
              console.log('🎤 Starting to listen for user response...')
              startListening()
            }
          }, 1000)
        }
      }

      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error)
        console.error('❌ Audio error details:', audio.error)
        setIsHiringManagerSpeaking(false)
        hiringManagerSpeakingRef.current = false
        URL.revokeObjectURL(audioUrl)
        
        // Fallback to visual-only mode
        console.log('🔇 Audio failed, using visual feedback...')
        const speechDuration = Math.max(4000, message.length * 60)
        setTimeout(() => {
          if (sessionStartedRef.current) {
            setIsPreparingToListen(true)
            setTimeout(() => {
              if (!hiringManagerSpeakingRef.current && sessionStartedRef.current) {
                startListening()
              }
            }, 1000)
          }
        }, speechDuration)
      }

      audio.onloadstart = () => console.log('🎵 Audio loading started')
      audio.oncanplay = () => console.log('🎵 Audio can play')
      audio.onplay = () => console.log('🎵 Audio play event fired')

      console.log('▶️ Starting OpenAI TTS audio playback...')
      try {
        await audio.play()
        console.log('✅ Audio.play() completed successfully')
      } catch (playError) {
        console.error('❌ Audio.play() failed:', playError)
        throw playError
      }
      
    } catch (error) {
      console.error('❌ TTS API error, using simulated speech:', error)
      // Final fallback - simulated speech
      const speechDuration = Math.max(4000, message.length * 60)
      console.log(`⏰ Final fallback: simulating speech for ${speechDuration}ms`)
      
      setTimeout(() => {
        if (sessionStartedRef.current) {
          console.log('✅ Fallback speech complete, setting up listening...')
          setIsHiringManagerSpeaking(false)
          hiringManagerSpeakingRef.current = false
          setIsPreparingToListen(true)
          
          setTimeout(() => {
            if (!hiringManagerSpeakingRef.current && sessionStartedRef.current) {
              console.log('🎤 Starting to listen for user response...')
              startListening()
            }
          }, 1000)
        }
      }, speechDuration)
    }
  }

  const startListening = () => {
    console.log('🎯 startListening called with conditions:', {
      sessionStarted: sessionStartedRef.current,
      isListening,
      hiringManagerSpeaking: hiringManagerSpeakingRef.current
    })
    
    if (!sessionStartedRef.current || isListening || hiringManagerSpeakingRef.current) {
      console.log('❌ Cannot start listening - conditions not met:', {
        sessionStarted: sessionStartedRef.current,
        isListening,
        hiringManagerSpeaking: hiringManagerSpeakingRef.current
      })
      return
    }

    console.log('🎤 Starting speech recognition...')
    setIsListening(true)
    setIsPreparingToListen(false)
    setCurrentResponse('')

    // Start turn timer when user starts speaking
    startTurnTimer()

    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.')
      setIsListening(false)
      return
    }

    try {
      const recognition = new (window as any).webkitSpeechRecognition()
      recognitionRef.current = recognition

      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.maxAlternatives = 1

      let finalTranscript = ''
      let silenceTimer: NodeJS.Timeout | null = null

      recognition.onstart = () => {
        console.log('🎙️ Speech recognition started')
        setIsRecording(true)
        
        // Set maximum recording time (60 seconds)
        maxRecordingTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Maximum recording time reached, stopping...')
          stopListening()
          if (finalTranscript.trim()) {
            processUserResponse(finalTranscript.trim())
          }
        }, 60000)
      }

      recognition.onresult = (event: any) => {
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        setCurrentResponse(finalTranscript + interimTranscript)

        // Clear existing silence timer
        if (silenceTimer) {
          clearTimeout(silenceTimer)
        }

        // Set new silence timer (2.5 seconds of silence)
        silenceTimer = setTimeout(() => {
          if (finalTranscript.trim()) {
            console.log('💭 Silence detected, processing response:', finalTranscript.trim())
            processUserResponse(finalTranscript.trim())
          }
        }, 2500)
        
        silenceTimeoutRef.current = silenceTimer
      }

      recognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error)
        if (event.error === 'no-speech') {
          console.log('👤 No speech detected, continuing to listen...')
        } else {
          setIsListening(false)
        setIsRecording(false)
        }
      }

      recognition.onend = () => {
        console.log('🔇 Speech recognition ended')
        setIsRecording(false)
        
        // Clear timeouts
        if (silenceTimer) {
          clearTimeout(silenceTimer)
        }
        if (maxRecordingTimeoutRef.current) {
          clearTimeout(maxRecordingTimeoutRef.current)
          maxRecordingTimeoutRef.current = null
        }
      }

        recognition.start()
      
      } catch (error) {
      console.error('❌ Error starting speech recognition:', error)
        setIsListening(false)
        setIsRecording(false)
    }
  }

  const stopListening = () => {
    console.log('⏹️ Stopping speech recognition...')
    setIsListening(false)
    setIsRecording(false)
    stopTurnTimer()
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        recognitionRef.current = null
      } catch (error) {
        console.error('❌ Error stopping recognition:', error)
      }
    }

    // Clear all timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current)
      maxRecordingTimeoutRef.current = null
    }
  }

  const processUserResponse = (userMessage: string) => {
    // Prevent duplicate processing - check message and timing
    const currentTime = Date.now()
    const lastMessageKey = `${userMessage.trim()}-${Math.floor(currentTime / 2000)}` // 2-second window
    
    if (isProcessingResponseRef.current || lastResponseKeyRef.current === lastMessageKey) {
      console.log('⚠️ Already processing this response, ignoring duplicate call')
      return
    }
    
    isProcessingResponseRef.current = true
    lastResponseKeyRef.current = lastMessageKey
    console.log('🔄 Processing user response:', userMessage)
    
    const turnDuration = stopTurnTimer()
    
    // ADD: Update Session Analytics with user response data
    updateSessionAnalytics(userMessage, turnDuration)
    
    // Add user response to conversation with timing
    const userResponse = {
      speaker: 'user' as const,
      message: userMessage,
      timestamp: new Date().toISOString(),
      duration: turnDuration
    }
    
    // Store the user turn count BEFORE updating conversation history
    let userTurnCount = 0
    
    // Update conversation history and get real-time turn count
    setConversationHistory(prev => {
      // Check if this exact message is already in the history (additional safety)
      const isDuplicate = prev.some(msg => 
        msg.speaker === 'user' && 
        msg.message === userMessage && 
        Math.abs(Date.now() - new Date(msg.timestamp).getTime()) < 5000 // Within 5 seconds
      )
      
      if (isDuplicate) {
        console.log('⚠️ Duplicate message detected in conversation history, skipping')
        isProcessingResponseRef.current = false // Reset flag
        return prev
      }
      
      const newHistory = [...prev, userResponse]
      
      // Calculate user turn count from the updated history
      userTurnCount = newHistory.filter(h => h.speaker === 'user').length
      console.log('DEBUG: Real-time user turn count =', userTurnCount)
      
      return newHistory
    })
    
    // Generate AI response OUTSIDE of the state setter to avoid multiple calls
    setTimeout(async () => {
      try {
        if (userTurnCount > 0) { // Only proceed if we have a valid turn count
          await generateEnhancedHiringManagerResponse(userMessage, turnDuration, userTurnCount)
        }
      } catch (error) {
        console.error('Error in generateEnhancedHiringManagerResponse:', error)
      } finally {
        // Reset processing flag after AI response completes
        isProcessingResponseRef.current = false
      }
    }, 500)
    
    setCurrentResponse('')
  }

  const generateEnhancedHiringManagerResponse = async (userMessage: string, userTurnDuration: number, userTurnCount: number) => {
    // Create unique key for this request to prevent duplicates
    const requestKey = `${userMessage}-${userTurnCount}-${Date.now()}`
    
    // Check if already generating to prevent duplicates
    if (hiringManagerSpeakingRef.current || lastResponseKeyRef.current === requestKey) {
      console.log('⚠️ Already generating response, skipping duplicate call')
      return
    }

    lastResponseKeyRef.current = requestKey
    console.log('🤖 Generating AI response for:', userMessage.substring(0, 100))

    const conversationTurn = userTurnCount
    const shouldMoveTowardResolution = conversationTurn >= 5 // Less aggressive
    const shouldOffer = conversationTurn <= 4 // More turns for offers
    const shouldClose = conversationTurn >= 8 // Much later closing
    
    console.log(`📊 Conversation stage: Turn ${conversationTurn}, Move to resolution: ${shouldMoveTowardResolution}, Should offer: ${shouldOffer}, Should close: ${shouldClose}`)
    
    const systemPrompt = `You are a professional hiring manager conducting a salary negotiation. Keep responses natural, realistic, and under 40 words.

Current offer details:
- Position: ${analysis?.position || 'Software Engineer'}
- Base Salary: $${analysis?.baseSalary || 100000}
- Company: ${analysis?.company || 'TechCorp'}

Guidelines:
- Turn ${conversationTurn}: ${shouldMoveTowardResolution ? 'Start moving toward resolution' : 'Explore candidate needs'}
- ${shouldOffer ? 'Make specific counteroffers when appropriate' : 'Focus on finding middle ground'}
- ${shouldClose ? 'Aim to conclude negotiation naturally' : 'Continue discussion'}
- Use specific numbers for salary/benefits when making offers
- Be professional but decisive
- Only conclude if candidate explicitly accepts or you've made a final offer
- Keep the conversation going unless there's a clear resolution

Conversation so far:
${conversationHistory.slice(-3).map(h => `${h.speaker}: ${h.message}`).join('\n')}

'Respond professionally as the hiring manager would in this negotiation:'`

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user', 
              content: userMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      const aiResponse = data.choices?.[0]?.message?.content || "I appreciate your perspective. Let me think about what we can do here."
      
      console.log('🤖 AI Response generated:', aiResponse.substring(0, 100))
      
      const hiringManagerMessage = {
        speaker: 'hiring_manager' as const,
        message: aiResponse,
        timestamp: new Date().toISOString(),
        duration: 0
      }
      
      // Add to conversation history (only once!)
      setConversationHistory(prev => [...prev, hiringManagerMessage])
      
      // Much more conservative closing detection - only end if very explicit
      const isClosingResponse = (aiResponse.toLowerCase().includes('welcome aboard') ||
                               aiResponse.toLowerCase().includes('congratulations') ||
                               (aiResponse.toLowerCase().includes('final offer') && 
                                (aiResponse.toLowerCase().includes('take it or leave it') || 
                                 aiResponse.toLowerCase().includes('cannot go higher'))) ||
                               conversationTurn >= 12) // Much higher threshold
      
      // Only auto-generate outcome if negotiation is clearly concluding
      if (isClosingResponse) {
        console.log('🎯 Negotiation clearly concluding, preparing outcome tracking...')
        setTimeout(() => {
          generateAutomaticOutcome(aiResponse, conversationTurn)
          // Auto-end session after outcome is generated
          setTimeout(() => {
            endSession()
          }, 5000) // More time to read final response
        }, 3000)
      }
      
      // Speak the response - this will handle the speaking flag management
      speakHiringManagerMessage(aiResponse)
      
    } catch (error) {
      console.error('Error generating AI response:', error)
      
      // Fallback response if API fails
      const fallbackResponse = "I understand your position. Let me see what flexibility we have and get back to you on this."
    
    const hiringManagerMessage = {
      speaker: 'hiring_manager' as const,
        message: fallbackResponse,
      timestamp: new Date().toISOString(),
      duration: 0
    }
    
    setConversationHistory(prev => [...prev, hiringManagerMessage])
      speakHiringManagerMessage(fallbackResponse)
    }
  }

  const generateAutomaticOutcome = (finalResponse: string, turnCount: number) => {
    console.log('🎯 Generating automatic negotiation outcome...', { finalResponse, turnCount })
    
    // Get original offer data from analysis
    const originalSalary = analysis?.baseSalary || analysis?.totalCompensation || 0
    console.log('💰 Original salary from analysis:', originalSalary)
    
    // Determine if negotiation was successful based on user participation and content
    const userResponses = conversationHistory.filter(h => h.speaker === 'user')
    const totalUserWords = userResponses.reduce((total, response) => total + response.message.split(' ').length, 0)
    
    // Check for negotiation success indicators
    const successIndicators = [
      'accept', 'agree', 'sounds good', 'deal', 'yes', 'perfect', 'great',
      'thank you', 'appreciate', 'looking forward'
    ]
    
    const rejectionIndicators = [
      'decline', 'reject', 'no thank', 'cannot accept', 'need to think',
      'not interested', 'pass', 'unfortunately'
    ]
    
    const hasSuccessIndicators = successIndicators.some(indicator => 
      finalResponse.toLowerCase().includes(indicator)
    )
    
    const hasRejectionIndicators = rejectionIndicators.some(indicator => 
      finalResponse.toLowerCase().includes(indicator)
    )
    
    // Extract salary numbers from conversation
    const salaryNumbers = conversationHistory
      .map(h => h.message)
      .join(' ')
      .match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*k?/gi)
      ?.map(match => {
        let num = parseFloat(match.replace(/[$,k]/gi, ''))
        if (match.toLowerCase().includes('k')) num *= 1000
        return num
      })
      .filter(num => num >= 30000 && num <= 1000000) // Reasonable salary range
      .sort((a, b) => b - a) // Sort descending
    
    console.log('💸 Extracted salary numbers:', salaryNumbers)
    
    // Determine final salary
    let finalSalary = originalSalary
    if (salaryNumbers && salaryNumbers.length > 0) {
      // Use the highest salary mentioned that's different from original
      const highestMentioned = salaryNumbers[0]
      if (highestMentioned !== originalSalary) {
        finalSalary = highestMentioned
      }
    }
    
    // Calculate changes
    const dollarIncrease = finalSalary - originalSalary
    const percentIncrease = originalSalary > 0 ? Math.round((dollarIncrease / originalSalary) * 100 * 10) / 10 : 0
    
    // Determine negotiation status
    let negotiationStatus: 'in_progress' | 'successful' | 'unsuccessful' | 'ended' = 'in_progress'
    if (hasSuccessIndicators && dollarIncrease >= 0) {
      negotiationStatus = 'successful'
    } else if (hasRejectionIndicators || dollarIncrease < 0) {
      negotiationStatus = 'unsuccessful'
    } else if (turnCount >= 8) {
      negotiationStatus = 'ended'
    }
    
    // Extract other benefits mentioned
    const benefits = extractBenefitsFromConversation()
    
    const outcome = {
      originalSalary: Number(originalSalary),
      finalSalary: Number(finalSalary),
      dollarIncrease,
      percentIncrease,
      otherBenefits: benefits,
      negotiationStatus
    }
    
    console.log('✅ Negotiation outcome generated:', outcome)
    setNegotiationOutcome(outcome)
    return outcome
  }

  const extractBenefitsFromConversation = (): string[] => {
    const benefits: string[] = []
    const allMessages = conversationHistory.map(h => h.message.toLowerCase()).join(' ')
    
    if (allMessages.includes('vacation') || allMessages.includes('pto')) {
      benefits.push('Additional PTO')
    }
    if (allMessages.includes('remote') || allMessages.includes('work from home')) {
      benefits.push('Remote work flexibility')
    }
    if (allMessages.includes('development') || allMessages.includes('training')) {
      benefits.push('Professional development budget')
    }
    if (allMessages.includes('bonus') || allMessages.includes('signing')) {
      benefits.push('Signing bonus')
    }
    if (allMessages.includes('equity') || allMessages.includes('stock')) {
      benefits.push('Equity/stock options')
    }
    
    return benefits
  }

  const endSession = () => {
    console.log('🔴 Ending voice practice session')
    
    // Stop all timers and recording
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
    
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }
    
    // Stop recognition if active
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.log('Recognition already stopped')
      }
    }
    
    // Calculate session time
    const sessionTime = stopSessionTimer()
    
    // Generate session summary
    const summary = generateSessionSummary(sessionTime)
    setSessionSummary(summary)
    
    // Reset states
    setIsListening(false)
    setIsHiringManagerSpeaking(false)
    setSessionStarted(false)
    sessionStartedRef.current = false
    hiringManagerSpeakingRef.current = false
    isListeningRef.current = false
    
    console.log('✅ Session ended, summary generated')
  }

  const endSessionWithOutcome = () => {
    console.log('🔴 Ending voice practice session with negotiation outcome')
    
    // Stop all timers and recording
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
    
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }
    
    // Stop recognition if active
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.log('Recognition already stopped')
      }
    }
    
    // Calculate session time
    const sessionTime = stopSessionTimer()
    
    // Generate session summary with negotiation outcome
    const summary = generateSessionSummary(sessionTime)
    summary.negotiationOutcome = negotiationOutcome
    setSessionSummary(summary)
    
    // Reset states
    setIsListening(false)
    setIsHiringManagerSpeaking(false)
    setSessionStarted(false)
    sessionStartedRef.current = false
    hiringManagerSpeakingRef.current = false
    isListeningRef.current = false
    
    console.log('✅ Session ended with outcome:', negotiationOutcome)
  }

  const generateSessionSummary = (sessionTime: number) => {
    const userTurns = conversationHistory.filter(h => h.speaker === 'user').length
    const totalTurns = conversationHistory.length
    const averageResponseTime = userTurns > 0 ? sessionTime / userTurns : 0

    // Extract negotiation topics from conversation
    const negotiationTopics = conversationHistory
      .filter(h => h.speaker === 'user')
      .map(h => h.message.toLowerCase())
      .reduce((topics: string[], message: string) => {
        if (message.includes('salary') || message.includes('pay')) topics.push('salary')
        if (message.includes('benefits') || message.includes('vacation') || message.includes('insurance')) topics.push('benefits')
        if (message.includes('remote') || message.includes('work from home') || message.includes('flexible')) topics.push('remote work')
        if (message.includes('bonus') || message.includes('signing bonus')) topics.push('bonus')
        if (message.includes('equity') || message.includes('stock') || message.includes('options')) topics.push('equity')
        if (message.includes('title') || message.includes('role') || message.includes('position')) topics.push('role/title')
        return topics
      }, [])

    // Remove duplicates
    const uniqueTopics = Array.from(new Set(negotiationTopics))

    const summary = {
      sessionDuration: sessionTime,
      totalTime: sessionTime,
      totalTurns,
      userTurns,
      hiringManagerTurns: totalTurns - userTurns,
      averageResponseTime: Math.round(averageResponseTime),
      averageWordsPerResponse: Math.round(
        conversationHistory
          .filter(h => h.speaker === 'user')
          .reduce((total, h) => total + h.message.split(' ').length, 0) / Math.max(userTurns, 1)
      ),
      scenario: voiceScenario,
      negotiationTopics: uniqueTopics, // Properly initialize this field
      conversationHistory,
      negotiationOutcome: negotiationOutcome, // Include the automatically generated outcome
      timestamp: new Date().toISOString(),
      
      // Initialize feedback fields - will be populated by API call
      structuredFeedback: null
    }

    console.log('📊 Session summary generated:', summary)

    // Generate structured feedback using ChatGPT if we have conversation history
    if (conversationHistory.length >= 2) {
      console.log('🧠 Requesting structured feedback from ChatGPT...')
      generateStructuredFeedback(conversationHistory, summary)
    } else {
      // Fallback for very short conversations
      const fallbackFeedback = {
        strengths: ["You engaged in the negotiation practice"],
        areasForImprovement: ["Try having a longer conversation to get more detailed feedback"],
        nextSteps: ["Practice another scenario with more back-and-forth"],
        overallScore: 6.0,
        keyInsights: ["Longer conversations provide better practice opportunities"]
      }
      
      setSessionSummary({
        ...summary,
        structuredFeedback: fallbackFeedback
      })
    }

    return summary
  }

  const generateStructuredFeedback = async (history: any[], summary: any) => {
    try {
      console.log('🧠 Generating structured feedback for conversation with', history.length, 'messages')
      console.log('📊 Enhanced analysis enabled: true')
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [], // Not used in feedback mode
          feedbackMode: true,
          conversationHistory: history,
          enhancedAnalysis: true, // Request enhanced analysis
        }),
      })

      if (!response.ok) {
        console.error('❌ Feedback API request failed:', response.status)
        throw new Error('Failed to generate structured feedback')
      }

      const result = await response.json()
      console.log('✅ Structured feedback received:', result.feedback)
      console.log('📈 Analysis type:', result.analysisType)
      
      // Update the session summary with structured feedback
      setSessionSummary((prev: any) => ({
        ...prev,
        ...summary, // Include the base summary data
        structuredFeedback: result.feedback,
        analysisType: result.analysisType
      }))

    } catch (error) {
      console.error('❌ Error generating structured feedback:', error)
      
      // Enhanced fallback feedback
      const fallbackFeedback = {
        strengths: [
          "You completed a full negotiation practice session",
          "You engaged actively throughout the conversation",
          "You maintained professional communication"
        ],
        areasForImprovement: [
          "Continue practicing to build confidence in negotiations",
          "Try exploring different negotiation strategies",
          "Practice with various scenarios to improve adaptability"
        ],
        nextSteps: [
          "Try negotiating different aspects of the offer",
          "Practice with a different scenario",
          "Focus on specific negotiation techniques"
        ],
        overallScore: 7.0,
        keyInsights: [
          "Regular practice builds negotiation confidence",
          "Real-time conversation skills are developing",
          "Voice practice helps prepare for actual negotiations"
        ]
      }
      
      setSessionSummary((prev: any) => ({
        ...prev,
        ...summary, // Include the base summary data
        structuredFeedback: fallbackFeedback
      }))
    }
  }

  return (
    <div className="space-y-6">
      {!isVoicePracticeActive ? (
        <>
          {/* Offer Summary - Display current offer details */}
          {analysis && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Your Offer Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Position:</span>
                  <p className="font-medium">{analysis.position}</p>
                </div>
                <div>
                  <span className="text-gray-600">Company:</span>
                  <p className="font-medium">{analysis.company}</p>
                </div>
                <div>
                  <span className="text-gray-600">Base Salary:</span>
                  <p className="font-medium">${analysis.baseSalary?.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Market Range:</span>
                  <p className="font-medium">${analysis.marketRange?.min?.toLocaleString()} - ${analysis.marketRange?.max?.toLocaleString()}</p>
                </div>
              </div>
              {analysis.offerScore && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">AI Score:</span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      analysis.offerScore >= 8 ? 'bg-green-100 text-green-800' :
                      analysis.offerScore >= 6 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {analysis.offerScore}/10
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Negotiation Focus Selection */}
          {/*
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">What would you like to negotiate?</h3>
            <p className="text-sm text-gray-600 mb-4">Select the areas you want to focus on during your practice session:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableNegotiationFoci.map((focus) => (
                <button
                  key={focus.id}
                  onClick={() => {
                    if (negotiationFocus.includes(focus.id)) {
                      setNegotiationFocus(prev => prev.filter(f => f !== focus.id))
                    } else {
                      setNegotiationFocus(prev => [...prev, focus.id])
                    }
                  }}
                  className={`p-3 text-left rounded-lg border transition-colors ${
                    negotiationFocus.includes(focus.id)
                      ? 'border-purple-500 bg-purple-50 text-purple-800'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{focus.label}</div>
                      <div className="text-xs text-gray-600 mt-1">{focus.description}</div>
                    </div>
                    {focus.suggested && (
                      <div className="ml-2">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          Suggested
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
          */}

          {/* Scenario Selection */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose Practice Scenario</h3>
            <div className="grid grid-cols-1 gap-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setVoiceScenario(scenario.title)}
                  className={`p-4 text-left rounded-lg border transition-colors ${
                    voiceScenario === scenario.title
                      ? 'border-purple-500 bg-purple-50 text-purple-800'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">{scenario.title}</div>
                      <div className="text-xs text-gray-600">{scenario.description}</div>
                    </div>
                    <div className="ml-4">
                      <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                        {scenario.category}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {liveKitError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm text-yellow-800 font-medium">Voice Service Issue</p>
                  <p className="text-xs text-yellow-700 mt-1">{liveKitError}</p>
                  <p className="text-xs text-yellow-700 mt-1">Voice practice will work with basic functionality.</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={startVoicePractice}
            disabled={!voiceScenario}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Start Voice Practice Session
          </button>
        </>
      ) : (
        <>
          {/* Active Session Interface */}
          <div className="bg-white rounded-lg shadow-lg">
            {/* Session Header with Timer */}
            <div className="bg-purple-50 rounded-t-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-purple-800">Voice Practice Session</h3>
                  <p className="text-sm text-purple-600">{voiceScenario}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    {/* Session Timer */}
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-600">Session:</span>
                        <span className="font-mono font-semibold text-purple-600">
                          {formatTime(totalSessionTime)}
                        </span>
                      </div>
                    </div>
                    {/* Turn Timer */}
                    {isListening && (
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-gray-600">Speaking:</span>
                          <span className="font-mono font-semibold text-green-600">
                            {formatTime(currentTurnTime)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Connection Status */}
                  {isLiveKitConnected && (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-xs">Connected</span>
                    </div>
                  )}
                  
                  {/* Voice Status Indicators */}
                  <div className="flex items-center space-x-2">
                    {isHiringManagerSpeaking && (
                      <div className="flex items-center text-blue-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
                        <span className="text-xs">AI Speaking</span>
                      </div>
                    )}
                    {isPreparingToListen && (
                      <div className="flex items-center text-yellow-600">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></div>
                        <span className="text-xs">Preparing</span>
                      </div>
                    )}
                    {isListening && (
                      <div className="flex items-center text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                        <span className="text-xs">Listening</span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={endSession}
                    className="text-sm text-purple-600 hover:text-purple-800 px-3 py-1 rounded border border-purple-300 hover:border-purple-500 transition-colors"
                  >
                    End Session
                  </button>
                </div>
              </div>
            </div>

            {/* Negotiation Focus Display */}
            {negotiationFocus.length > 0 && (
              <div className="bg-blue-50 border-b border-blue-200 p-4">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">Negotiation Focus:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {negotiationFocus.map(focusId => {
                    const focus = availableNegotiationFoci.find(f => f.id === focusId)
                    return focus ? (
                      <span key={focusId} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {focus.label}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* Live Response Display */}
            {currentResponse && (
              <div className="bg-green-50 border-b border-green-200 p-4">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800">You're speaking... ({formatTime(currentTurnTime)})</span>
                </div>
                <p className="text-sm text-green-700 italic">"{currentResponse}"</p>
              </div>
            )}

            {/* Conversation History */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {conversationHistory.map((entry, index) => (
                  <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg text-sm ${
                      entry.speaker === 'user' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 border border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-xs opacity-75">
                          {entry.speaker === 'user' ? 'You' : 'Hiring Manager'}
                        </div>
                        {entry.duration !== undefined && entry.duration > 0 && (
                          <div className="text-xs opacity-60">
                            {formatTime(entry.duration)}
                          </div>
                        )}
                      </div>
                      <div className="leading-relaxed">{entry.message}</div>
                    </div>
                  </div>
                ))}
                
                {conversationHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-gray-400 py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm">Conversation will appear here...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Practice Tips */}
            {/*
            <div className="bg-blue-50 rounded-b-lg p-4 border-t border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                💡 Real-time Tips
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Speak naturally - pause for 3 seconds when done</li>
                <li>• Use specific numbers and examples</li>
                <li>• Reference your offer details in your responses</li>
                <li>• Stay collaborative and professional</li>
                <li>• Keep responses concise but thorough (15-45 seconds ideal)</li>
              </ul>
            </div>
            */}

            {/* Voice Recording Status */}
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Voice Recording Status</h3>
                <div className="flex items-center space-x-2">
                  {isPreparingToListen && (
                    <div className="flex items-center text-yellow-600">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-sm font-medium">Preparing to listen...</span>
                    </div>
                  )}
                  {isListening && !isRecording && (
                    <div className="flex items-center text-blue-600">
                      <div className="w-3 h-3 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-sm font-medium">Listening...</span>
                    </div>
                  )}
                  {isRecording && (
                    <div className="flex items-center text-red-600">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-sm font-medium">Recording...</span>
                    </div>
                  )}
                  {!isListening && !isRecording && !isPreparingToListen && (
                    <div className="flex items-center text-gray-500">
                      <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                      <span className="text-sm font-medium">Waiting...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Microphone Visual Indicator */}
              <div className="flex items-center justify-center py-4">
                <div className={`relative ${isRecording ? 'animate-pulse' : ''}`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording ? 'bg-red-100 border-4 border-red-500' : 
                    isListening ? 'bg-blue-100 border-4 border-blue-500' : 
                    'bg-gray-100 border-4 border-gray-300'
                  }`}>
                    <svg className={`w-8 h-8 ${
                      isRecording ? 'text-red-600' : 
                      isListening ? 'text-blue-600' : 
                      'text-gray-500'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  {isRecording && (
                    <div className="absolute -inset-1 rounded-full border-2 border-red-300 animate-ping"></div>
                  )}
                </div>
              </div>

              {/* Status Message */}
              <div className="text-center">
                {isHiringManagerSpeaking && (
                  <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
                      <span className="text-lg font-bold text-blue-800">🤖 AI is Speaking...</span>
                      <div className="w-4 h-4 bg-blue-500 rounded-full ml-3 animate-pulse"></div>
                    </div>
                    <p className="text-sm text-blue-600">Please wait for the AI to finish before responding</p>
                  </div>
                )}
                {isRecording && (
                  <p className="text-red-600 font-medium">🎤 Recording your response...</p>
                )}
                {isListening && !isRecording && (
                  <p className="text-blue-600 font-medium">👂 Listening for your voice...</p>
                )}
                {isPreparingToListen && (
                  <p className="text-yellow-600 font-medium">⏳ Get ready to speak...</p>
                )}
                {!isListening && !isRecording && !isPreparingToListen && !isHiringManagerSpeaking && (
                  <p className="text-gray-500">⏸️ Microphone inactive</p>
                )}
              </div>
            </div>

            {/* Manual Controls */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Manual Controls</h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Voice Recording Controls */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium">Recording</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={startListening}
                      disabled={isListening || !sessionStarted || isHiringManagerSpeaking}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-xs hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      🎤 Start
                    </button>
                    <button
                      onClick={stopListening}
                      disabled={!isListening}
                      className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-xs hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      ⏹️ Stop
                    </button>
                  </div>
                </div>

                {/* Session Controls */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium">Session</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={endSession}
                      disabled={!sessionStarted}
                      className="flex-1 bg-purple-600 text-white px-3 py-2 rounded text-xs hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      📊 End
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Session Analysis - Show after session completion */}
      {sessionSummary && (
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Voice Practice Analysis
            </h3>
            <button
              onClick={() => setSessionSummary(null)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Session Metrics */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3">📊 Session Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Duration:</span>
                  <span className="font-medium">{formatTime(sessionSummary.totalTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Responses:</span>
                  <span className="font-medium">{sessionSummary.userTurns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Response Time:</span>
                  <span className="font-medium">{sessionSummary.averageResponseTime}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Words/Response:</span>
                  <span className="font-medium">{sessionSummary.averageWordsPerResponse}</span>
                </div>
              </div>
            </div>

            {/* Negotiation Results or Session Stats */}
            {sessionSummary.negotiationOutcome ? (
            <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3">💰 Negotiation Results</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Offer:</span>
                    <span className="font-medium">${sessionSummary.negotiationOutcome.originalSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Final Salary:</span>
                    <span className="font-medium">${sessionSummary.negotiationOutcome.finalSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Increase:</span>
                    <span className={`font-medium ${
                      sessionSummary.negotiationOutcome.dollarIncrease > 0 ? 'text-green-600' : 
                      sessionSummary.negotiationOutcome.dollarIncrease < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      ${sessionSummary.negotiationOutcome.dollarIncrease.toLocaleString()} 
                      ({sessionSummary.negotiationOutcome.percentIncrease > 0 ? '+' : ''}{sessionSummary.negotiationOutcome.percentIncrease}%)
                    </span>
                </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium capitalize ${
                      sessionSummary.negotiationOutcome.negotiationStatus === 'successful' ? 'text-green-600' :
                      sessionSummary.negotiationOutcome.negotiationStatus === 'unsuccessful' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {sessionSummary.negotiationOutcome.negotiationStatus.replace('_', ' ')}
                    </span>
              </div>
                  {sessionSummary.negotiationOutcome.otherBenefits.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <span className="text-gray-600 text-xs">Other Benefits:</span>
                      <div className="mt-1">
                        {sessionSummary.negotiationOutcome.otherBenefits.map((benefit: string, index: number) => (
                          <span key={index} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                            {benefit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">📈 Session Stats</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Exchanges:</span>
                    <span className="font-medium">{sessionSummary.totalTurns}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Topics Discussed:</span>
                    <span className="font-medium">{sessionSummary.negotiationTopics?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Engagement Level:</span>
                    <span className="font-medium">
                      {sessionSummary.userTurns >= 5 ? 'High' : sessionSummary.userTurns >= 3 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            </div>

          {/* Performance Insights - Enhanced with Structured Feedback */}
          <div className="space-y-4 mb-6">
            {sessionSummary.structuredFeedback ? (
              <>
                {/* AI-Generated Structured Feedback */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800 flex items-center">
                      🤖 AI Negotiation Analysis
                      {sessionSummary.analysisType === 'enhanced' && (
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                          ✨ Enhanced
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-2">Overall Score:</span>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        sessionSummary.structuredFeedback.overallScore >= 8 ? 'bg-green-100 text-green-800' :
                        sessionSummary.structuredFeedback.overallScore >= 6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sessionSummary.structuredFeedback.overallScore}/10
                    </div>
              </div>
            </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <h5 className="font-semibold text-green-800 mb-3 flex items-center">
                        ✅ What You Did Well
                      </h5>
                      <ul className="space-y-2">
                        {sessionSummary.structuredFeedback.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-green-600 mr-2 mt-1">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
          </div>

                    {/* Areas for Improvement */}
                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                      <h5 className="font-semibold text-orange-800 mb-3 flex items-center">
                        🎯 Areas to Improve
                      </h5>
                      <ul className="space-y-2">
                        {sessionSummary.structuredFeedback.areasForImprovement.map((improvement: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-orange-600 mr-2 mt-1">•</span>
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className="mt-4 bg-white rounded-lg p-4 border border-blue-200">
                    <h5 className="font-semibold text-blue-800 mb-3 flex items-center">
                      🚀 Your Next Steps
                    </h5>
                    <ul className="space-y-2">
                      {sessionSummary.structuredFeedback.nextSteps.map((step: string, index: number) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start">
                          <span className="text-blue-600 mr-2 mt-1">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Key Insights */}
                  {sessionSummary.structuredFeedback.keyInsights && sessionSummary.structuredFeedback.keyInsights.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
                      <h5 className="font-semibold text-purple-800 mb-3 flex items-center">
                        💡 Key Insights
                      </h5>
                      <ul className="space-y-2">
                        {sessionSummary.structuredFeedback.keyInsights.map((insight: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-start">
                            <span className="text-purple-600 mr-2 mt-1">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Enhanced Analysis Summary */}
                  {sessionSummary.analysisType === 'enhanced' && sessionSummary.structuredFeedback && (
                    <div className="mt-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                      <h5 className="font-semibold text-purple-800 mb-3 flex items-center">
                        ✨ Enhanced Analysis Summary
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Sentiment Analysis */}
                        {sessionSummary.structuredFeedback.sentimentAnalysis && (
                          <div className="bg-white rounded p-3">
                            <h6 className="font-medium text-gray-800 text-sm mb-2">💭 Sentiment</h6>
                            <div className="text-sm text-gray-600">
                              <div className="flex justify-between items-center mb-1">
                                <span>Overall:</span>
                                <span className={`font-medium ${
                                  sessionSummary.structuredFeedback.sentimentAnalysis.overallSentiment === 'positive' ? 'text-green-600' :
                                  sessionSummary.structuredFeedback.sentimentAnalysis.overallSentiment === 'negative' ? 'text-red-600' :
                                  'text-yellow-600'
                                }`}>
                                  {sessionSummary.structuredFeedback.sentimentAnalysis.overallSentiment}
                                </span>
                              </div>
                              {sessionSummary.structuredFeedback.sentimentAnalysis.sentimentScore && (
                                <div className="flex justify-between items-center">
                                  <span>Score:</span>
                                  <span className="font-medium">{(sessionSummary.structuredFeedback.sentimentAnalysis.sentimentScore * 10).toFixed(1)}/10</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Confidence Analysis */}
                        {sessionSummary.structuredFeedback.confidenceAnalysis && (
                          <div className="bg-white rounded p-3">
                            <h6 className="font-medium text-gray-800 text-sm mb-2">🎯 Confidence</h6>
                            <div className="text-sm text-gray-600">
                              <div className="flex justify-between items-center mb-1">
                                <span>Level:</span>
                                <span className={`font-medium ${
                                  sessionSummary.structuredFeedback.confidenceAnalysis.overallConfidence === 'high' ? 'text-green-600' :
                                  sessionSummary.structuredFeedback.confidenceAnalysis.overallConfidence === 'low' ? 'text-red-600' :
                                  'text-yellow-600'
                                }`}>
                                  {sessionSummary.structuredFeedback.confidenceAnalysis.overallConfidence}
                                </span>
                              </div>
                              {sessionSummary.structuredFeedback.confidenceAnalysis.confidenceScore && (
                                <div className="flex justify-between items-center">
                                  <span>Score:</span>
                                  <span className="font-medium">{(sessionSummary.structuredFeedback.confidenceAnalysis.confidenceScore * 10).toFixed(1)}/10</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Communication Style */}
                        {sessionSummary.structuredFeedback.communicationStyle && (
                          <div className="bg-white rounded p-3">
                            <h6 className="font-medium text-gray-800 text-sm mb-2">🗣️ Communication</h6>
                            <div className="text-sm text-gray-600">
                              {sessionSummary.structuredFeedback.communicationStyle.tone && (
                                <div className="flex justify-between items-center mb-1">
                                  <span>Tone:</span>
                                  <span className="font-medium">{sessionSummary.structuredFeedback.communicationStyle.tone}</span>
                                </div>
                              )}
                              {sessionSummary.structuredFeedback.communicationStyle.clarity && (
                                <div className="flex justify-between items-center mb-1">
                                  <span>Clarity:</span>
                                  <span className="font-medium">{(sessionSummary.structuredFeedback.communicationStyle.clarity * 10).toFixed(1)}/10</span>
                                </div>
                              )}
                              {sessionSummary.structuredFeedback.communicationStyle.persuasiveness && (
                                <div className="flex justify-between items-center">
                                  <span>Persuasiveness:</span>
                                  <span className="font-medium">{(sessionSummary.structuredFeedback.communicationStyle.persuasiveness * 10).toFixed(1)}/10</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Fallback Performance Insights */
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-800 mb-3">💡 Performance Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-green-700 mb-2">✅ Strengths</h5>
                <ul className="space-y-1 text-gray-700">
                  {sessionSummary.averageResponseTime >= 15 && sessionSummary.averageResponseTime <= 45 && (
                    <li>• Good response timing - professional pace</li>
                  )}
                  {sessionSummary.averageWordsPerResponse >= 20 && (
                    <li>• Detailed responses - good content depth</li>
                  )}
                  {sessionSummary.userTurns >= 3 && (
                    <li>• Active engagement throughout session</li>
                  )}
                  {sessionSummary.negotiationTopics && sessionSummary.negotiationTopics.length >= 2 && (
                    <li>• Multi-faceted negotiation approach</li>
                  )}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-orange-700 mb-2">🎯 Areas for Improvement</h5>
                <ul className="space-y-1 text-gray-700">
                  {sessionSummary.averageResponseTime < 15 && (
                    <li>• Consider taking more time to formulate responses</li>
                  )}
                  {sessionSummary.averageResponseTime > 45 && (
                    <li>• Try to be more concise in your responses</li>
                  )}
                  {sessionSummary.averageWordsPerResponse < 15 && (
                    <li>• Provide more detailed explanations and examples</li>
                  )}
                  {sessionSummary.userTurns < 3 && (
                    <li>• Engage in longer practice sessions for better results</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
            )}
          </div>

          {/* Conversation Review */}
          {/* Removed conversation review section as requested */}

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setSessionSummary(null)
                setNegotiationFocus([])
              }}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}

      {/* Negotiation Outcome Input Modal */}
      {showOutcomeInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Record Negotiation Outcome</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Original Salary Offer
                </label>
                <input
                  type="number"
                  value={negotiationOutcome.originalSalary}
                  onChange={(e) => setNegotiationOutcome(prev => ({
                    ...prev,
                    originalSalary: Number(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 75000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final Negotiated Salary
                </label>
                <input
                  type="number"
                  value={negotiationOutcome.finalSalary}
                  onChange={(e) => {
                    const finalSalary = Number(e.target.value)
                    const originalSalary = negotiationOutcome.originalSalary
                    const dollarIncrease = finalSalary - originalSalary
                    const percentIncrease = originalSalary > 0 ? (dollarIncrease / originalSalary) * 100 : 0
                    
                    setNegotiationOutcome(prev => ({
                      ...prev,
                      finalSalary,
                      dollarIncrease,
                      percentIncrease: Math.round(percentIncrease * 100) / 100
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 82000"
                />
              </div>
              
              {negotiationOutcome.finalSalary !== negotiationOutcome.originalSalary && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Increase:</span>
                      <span className="font-medium">
                        ${negotiationOutcome.dollarIncrease.toLocaleString()} 
                        ({negotiationOutcome.percentIncrease > 0 ? '+' : ''}{negotiationOutcome.percentIncrease}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Negotiation Status
                </label>
                <select
                  value={negotiationOutcome.negotiationStatus}
                  onChange={(e) => setNegotiationOutcome(prev => ({
                    ...prev,
                    negotiationStatus: e.target.value as any
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="successful">Successful - Got increase</option>
                  <option value="unsuccessful">Unsuccessful - No increase</option>
                  <option value="ended">Ended - Need to follow up</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Other Benefits Negotiated (optional)
                </label>
                <textarea
                  value={negotiationOutcome.otherBenefits.join(', ')}
                  onChange={(e) => setNegotiationOutcome(prev => ({
                    ...prev,
                    otherBenefits: e.target.value.split(',').map(b => b.trim()).filter(b => b)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Extra vacation days, Remote work, Sign-on bonus"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  endSessionWithOutcome()
                  setShowOutcomeInput(false)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save & End Session
              </button>
              <button
                onClick={() => setShowOutcomeInput(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 

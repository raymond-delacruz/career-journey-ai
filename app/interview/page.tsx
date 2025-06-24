'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LiveKitRoom, AudioConference, RoomAudioRenderer } from '@livekit/components-react'
import { Room } from 'livekit-client'
import { InterviewBot } from '../components/InterviewBot'
import '@livekit/components-styles'

// Custom animations
const customStyles = `
  .animation-delay-75 {
    animation-delay: 75ms;
  }
  .animation-delay-100 {
    animation-delay: 100ms;
  }
  .animation-delay-200 {
    animation-delay: 200ms;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-in {
    animation: fadeIn 0.5s ease-out;
  }
`

interface Question {
  id: number
  text: string
  category: string
  context?: string // Optional context field that won't be displayed
  tableSchema?: {
    tables: {
      name: string
      columns: {
        name: string
        type: string
        description?: string
      }[]
      sampleData?: {
        [key: string]: any
      }[]
    }[]
  }
}

interface TranscriptEntry {
  question: string
  answer: string
  timestamp: Date
  sqlCode?: string
  timeSpent?: number // Time spent on this question in seconds
}

interface LiveKitToken {
  token: string
  identity: string
  room: string
}

export default function InterviewPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [currentSqlCode, setCurrentSqlCode] = useState('')
  const [isInterviewComplete, setIsInterviewComplete] = useState(false)
  const [isInterviewStarted, setIsInterviewStarted] = useState(false)
  const [isPreparingToListen, setIsPreparingToListen] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [liveKitToken, setLiveKitToken] = useState<LiveKitToken | null>(null)
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false)
  const [liveKitRoom, setLiveKitRoom] = useState<Room | null>(null)
  const [autoMode, setAutoMode] = useState(true)
  const [liveKitConnectionAttempted, setLiveKitConnectionAttempted] = useState(false)
  const [liveKitError, setLiveKitError] = useState<string | null>(null)
  const [showLiveKitWarning, setShowLiveKitWarning] = useState(false)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  
  // Timer states
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(0) // Total interview time remaining in seconds
  const [currentQuestionTime, setCurrentQuestionTime] = useState(0) // Time spent on current question in seconds
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null) // When current question started
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoModeRef = useRef(autoMode)
  const isInterviewStartedRef = useRef(isInterviewStarted)
  const isProcessingAnswerRef = useRef(false)
  const maxRecordingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const forceProgressionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const botIsSpeakingRef = useRef(false)
  const isListeningRef = useRef(false)
  const lastCallTimestampRef = useRef(0)
  const processedTransactionIds = useRef(new Set<string>())
  const currentTransactionId = useRef<string | null>(null)
  
  // Timer refs
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null)
  const questionTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync with state
  useEffect(() => {
    autoModeRef.current = autoMode
  }, [autoMode])

  useEffect(() => {
    isInterviewStartedRef.current = isInterviewStarted
  }, [isInterviewStarted])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  const jobTitle = searchParams?.get('jobTitle') || 'Software Engineer'
  const level = searchParams?.get('level') || 'Mid Level'
  const companyStage = searchParams?.get('companyStage') || ''
  const duration = parseInt(searchParams?.get('duration') || '15')
  const stage = searchParams?.get('stage') || 'Recruiter Screen'
  const customQuestionsParam = searchParams?.get('customQuestions')

  // Check if current stage is SQL Test
  const isSqlTest = stage === 'SQL Test'
  
  // Debug logging for SQL Test detection
  console.log('🔍 SQL Test Debug:', {
    stage,
    isSqlTest,
    jobTitle,
    level,
    companyStage
  })

  // Timer utility functions
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startTotalTimer = () => {
    const totalSeconds = duration * 60 // Convert minutes to seconds
    setTotalTimeRemaining(totalSeconds)
    
    totalTimerRef.current = setInterval(() => {
      setTotalTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - end interview
          console.log('⏰ Interview time expired')
          handleTimeExpired()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopTotalTimer = () => {
    if (totalTimerRef.current) {
      clearInterval(totalTimerRef.current)
      totalTimerRef.current = null
    }
  }

  const startQuestionTimer = () => {
    setQuestionStartTime(new Date())
    setCurrentQuestionTime(0)
    
    questionTimerRef.current = setInterval(() => {
      setCurrentQuestionTime(prev => prev + 1)
    }, 1000)
  }

  const stopQuestionTimer = (): number => {
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current)
      questionTimerRef.current = null
    }
    
    const timeSpent = questionStartTime 
      ? Math.floor((new Date().getTime() - questionStartTime.getTime()) / 1000)
      : currentQuestionTime
    
    return timeSpent
  }

  const handleTimeExpired = () => {
    console.log('⏰ Interview time expired - completing interview')
    stopListening()
    stopQuestionTimer()
    setIsInterviewComplete(true)
    
    // Save current answer if any
    if (currentAnswer.trim() && currentQuestion) {
      const timeSpent = stopQuestionTimer()
      const finalEntry: TranscriptEntry = {
        question: currentQuestion.text,
        answer: currentAnswer.trim(),
        timestamp: new Date(),
        timeSpent,
        ...(isSqlTest && currentSqlCode ? { sqlCode: currentSqlCode } : {})
      }
      
      setTranscript(prev => {
        const finalTranscript = [...prev, finalEntry]
        // Generate feedback with complete transcript
        setTimeout(() => generateFeedback(finalTranscript), 100)
        return finalTranscript
      })
    } else if (transcript.length > 0) {
      // Generate feedback with existing transcript
      setTimeout(() => generateFeedback(transcript), 100)
    }
  }

  // Parse custom questions if provided
  const customQuestions: Question[] | null = customQuestionsParam 
    ? (() => {
        try {
          const parsed = JSON.parse(customQuestionsParam)
          return parsed.map((q: any, index: number) => ({
            id: index + 1,
            text: q.question || q.text,
            category: q.category || 'Custom', // Use actual category, not context
            context: q.context, // Store context but don't display it
            tableSchema: q.tableSchema
          }))
        } catch (error) {
          console.error('Failed to parse custom questions:', error)
          return null
        }
      })()
    : null

  const getStageSpecificQuestions = (stage: string, jobTitle: string, level: string, companyStage: string): Question[] => {
    // Get role-specific context instead of company-stage focused context
    const getRoleContext = (jobTitle: string, level: string) => {
      const levelContext = {
        'Entry Level (0-2 years)': {
          focus: 'foundational skills, learning ability, basic problem-solving',
          expectations: 'demonstrate potential, show eagerness to learn, basic technical competency',
          challenges: 'building confidence, applying theoretical knowledge, adapting to professional environment'
        },
        'Mid Level (3-5 years)': {
          focus: 'practical experience, independent work, project ownership',
          expectations: 'proven track record, technical proficiency, collaboration skills',
          challenges: 'handling complex projects, mentoring others, balancing multiple priorities'
        },
        'Senior Level (6-10 years)': {
          focus: 'technical leadership, system design, strategic thinking',
          expectations: 'deep expertise, mentorship capability, architectural decisions',
          challenges: 'leading technical initiatives, cross-functional collaboration, scaling systems'
        },
        'Staff/Principal (10+ years)': {
          focus: 'technical strategy, organizational impact, innovation',
          expectations: 'industry expertise, thought leadership, driving technical vision',
          challenges: 'influencing without authority, balancing technical debt, long-term planning'
        },
        'Executive/Leadership': {
          focus: 'strategic vision, team building, business impact',
          expectations: 'organizational leadership, stakeholder management, business acumen',
          challenges: 'scaling teams, aligning technical and business goals, driving cultural change'
        }
      }

      const roleSpecifics = {
        'Data Analyst': {
          coreSkills: 'SQL, data visualization, statistical analysis, business intelligence',
          keyResponsibilities: 'data interpretation, reporting, trend analysis, stakeholder communication',
          tools: 'Excel, SQL, Tableau/PowerBI, Python/R'
        },
        'Product Manager': {
          coreSkills: 'product strategy, user research, roadmap planning, stakeholder management',
          keyResponsibilities: 'feature prioritization, user experience design, market analysis, cross-functional leadership',
          tools: 'analytics platforms, user research tools, project management software'
        }
      }

          return {
        level: levelContext[level as keyof typeof levelContext] || levelContext['Mid Level (3-5 years)'],
        role: roleSpecifics[jobTitle as keyof typeof roleSpecifics] || {
          coreSkills: 'role-specific technical and soft skills',
          keyResponsibilities: 'core job functions and deliverables',
          tools: 'industry-standard tools and technologies'
        }
      }
    }

    const context = getRoleContext(jobTitle, level)

    const baseQuestions: Record<string, Question[]> = {
      'Recruiter Screen': [
        { id: 1, text: `Tell me about yourself and why you're interested in this ${jobTitle} position.`, category: 'Introduction' },
        { id: 2, text: `What specific aspects of ${context.role.keyResponsibilities} excite you most about this role?`, category: 'Motivation' },
        { id: 3, text: `Walk me through your experience with ${context.role.coreSkills} and how it's prepared you for a ${level} ${jobTitle} role.`, category: 'Experience' },
        { id: 4, text: `What draws you to ${jobTitle} work, and how do you see this role fitting into your career progression?`, category: 'Career Goals' },
        { id: 5, text: `What do you know about the day-to-day responsibilities of a ${jobTitle}, particularly around ${context.role.keyResponsibilities}?`, category: 'Role Understanding' }
      ],
      'Hiring Manager Screen': [
        { id: 1, text: `Tell me about a challenging project where you demonstrated ${context.level.focus} relevant to ${jobTitle} work.`, category: 'Experience' },
        { id: 2, text: `How do you approach ${context.role.keyResponsibilities} when working with cross-functional teams?`, category: 'Collaboration' },
        { id: 3, text: `Describe your problem-solving approach when dealing with ${context.level.challenges} in your current or previous ${jobTitle} role.`, category: 'Problem Solving' },
        { id: 4, text: `What are your biggest strengths in ${context.role.coreSkills} and how would they help you succeed as a ${level} ${jobTitle}?`, category: 'Strengths' },
        { id: 5, text: `Where do you see yourself growing in the ${jobTitle} field over the next 2-3 years, particularly in ${context.level.focus}?`, category: 'Career Development' }
      ],
      'Technical Interview': [
        { id: 1, text: `Describe your hands-on experience with ${context.role.tools} and how you've applied ${context.role.coreSkills} in previous projects.`, category: 'Technical Skills' },
        { id: 2, text: `Walk me through how you'd approach a complex ${jobTitle} challenge that requires ${context.level.expectations}.`, category: 'Problem Solving' },
        { id: 3, text: `How do you stay current with ${context.role.tools} and best practices in ${context.role.keyResponsibilities}?`, category: 'Continuous Learning' },
        { id: 4, text: `Describe a time when you had to ${context.level.challenges} - how did you handle it and what was the outcome?`, category: 'Technical Leadership' },
        { id: 5, text: `How do you ensure quality and accuracy in your ${context.role.keyResponsibilities}, especially when ${context.level.challenges}?`, category: 'Quality Assurance' }
      ],
      'SQL Test': [
        { 
          id: 1, 
          text: `Write a SQL query to analyze customer acquisition costs - find the top 5 acquisition channels by ROI from 'marketing_campaigns' and 'customer_acquisitions' tables.`, 
          category: 'Business Analytics',
          tableSchema: {
            tables: [
              {
                name: 'marketing_campaigns',
                columns: [
                  { name: 'campaign_id', type: 'INT PRIMARY KEY', description: 'Unique campaign identifier' },
                  { name: 'channel', type: 'VARCHAR(50)', description: 'Marketing channel (Google Ads, Facebook, etc.)' },
                  { name: 'campaign_name', type: 'VARCHAR(100)', description: 'Campaign name' },
                  { name: 'start_date', type: 'DATE', description: 'Campaign start date' },
                  { name: 'end_date', type: 'DATE', description: 'Campaign end date' },
                  { name: 'budget', type: 'DECIMAL(10,2)', description: 'Total campaign budget' },
                  { name: 'spend', type: 'DECIMAL(10,2)', description: 'Actual amount spent' }
                ],
                sampleData: [
                  { campaign_id: 1, channel: 'Google Ads', campaign_name: 'Q4 Search Campaign', start_date: '2024-01-01', end_date: '2024-01-31', budget: 10000.00, spend: 9500.00 },
                  { campaign_id: 2, channel: 'Facebook', campaign_name: 'Social Media Push', start_date: '2024-01-01', end_date: '2024-01-31', budget: 8000.00, spend: 7800.00 },
                  { campaign_id: 3, channel: 'LinkedIn', campaign_name: 'B2B Outreach', start_date: '2024-01-01', end_date: '2024-01-31', budget: 5000.00, spend: 4900.00 }
                ]
              },
              {
                name: 'customer_acquisitions',
                columns: [
                  { name: 'acquisition_id', type: 'INT PRIMARY KEY', description: 'Unique acquisition record' },
                  { name: 'campaign_id', type: 'INT', description: 'References marketing_campaigns.campaign_id' },
                  { name: 'customer_id', type: 'INT', description: 'Unique customer identifier' },
                  { name: 'acquisition_date', type: 'DATE', description: 'Date customer was acquired' },
                  { name: 'customer_value', type: 'DECIMAL(10,2)', description: 'Lifetime value of customer' },
                  { name: 'conversion_type', type: 'VARCHAR(50)', description: 'Type of conversion (trial, purchase, etc.)' }
                ],
                sampleData: [
                  { acquisition_id: 1, campaign_id: 1, customer_id: 101, acquisition_date: '2024-01-15', customer_value: 1200.00, conversion_type: 'purchase' },
                  { acquisition_id: 2, campaign_id: 1, customer_id: 102, acquisition_date: '2024-01-16', customer_value: 800.00, conversion_type: 'trial' },
                  { acquisition_id: 3, campaign_id: 2, customer_id: 103, acquisition_date: '2024-01-18', customer_value: 1500.00, conversion_type: 'purchase' }
                ]
              }
            ]
          }
        },
        { id: 2, text: `Create a query to track key business metrics: Calculate month-over-month growth rates for important KPIs.`, category: 'Growth Analysis' },
        { 
          id: 3, 
          text: `Write a query to identify data quality issues: Find anomalies in user behavior that might indicate problems with data collection.`, 
          category: 'Data Quality',
          tableSchema: {
            tables: [
              {
                name: 'user_events',
                columns: [
                  { name: 'event_id', type: 'BIGINT PRIMARY KEY', description: 'Unique event identifier' },
                  { name: 'user_id', type: 'INT', description: 'User who performed the event' },
                  { name: 'event_type', type: 'VARCHAR(50)', description: 'Type of event (login, click, purchase, etc.)' },
                  { name: 'event_timestamp', type: 'TIMESTAMP', description: 'When the event occurred' },
                  { name: 'session_id', type: 'VARCHAR(100)', description: 'User session identifier' },
                  { name: 'page_url', type: 'VARCHAR(255)', description: 'Page where event occurred' },
                  { name: 'user_agent', type: 'VARCHAR(500)', description: 'Browser/device information' }
                ],
                sampleData: [
                  { event_id: 1001, user_id: 1, event_type: 'login', event_timestamp: '2024-01-15 09:00:00', session_id: 'sess_abc123', page_url: '/dashboard', user_agent: 'Chrome/120.0' },
                  { event_id: 1002, user_id: 1, event_type: 'click', event_timestamp: '2024-01-15 09:05:00', session_id: 'sess_abc123', page_url: '/products', user_agent: 'Chrome/120.0' },
                  { event_id: 1003, user_id: 2, event_type: 'login', event_timestamp: '2024-01-15 10:00:00', session_id: 'sess_def456', page_url: '/dashboard', user_agent: 'Safari/17.0' }
                ]
              }
            ]
          }
        },
        { id: 4, text: `Design a query using window functions to rank products by performance within each business segment.`, category: 'Advanced Analytics' },
        { 
          id: 5, 
          text: `Create a cohort analysis query to understand user retention patterns and identify trends over time.`, 
          category: 'Retention Analysis',
          tableSchema: {
            tables: [
              {
                name: 'users',
                columns: [
                  { name: 'user_id', type: 'INT PRIMARY KEY', description: 'Unique user identifier' },
                  { name: 'email', type: 'VARCHAR(255)', description: 'User email address' },
                  { name: 'signup_date', type: 'DATE', description: 'Date user signed up' },
                  { name: 'plan_type', type: 'VARCHAR(50)', description: 'Subscription plan (free, premium, enterprise)' },
                  { name: 'signup_source', type: 'VARCHAR(100)', description: 'How user found the product' }
                ],
                sampleData: [
                  { user_id: 1, email: 'user1@example.com', signup_date: '2024-01-01', plan_type: 'premium', signup_source: 'google_ads' },
                  { user_id: 2, email: 'user2@example.com', signup_date: '2024-01-01', plan_type: 'free', signup_source: 'organic' },
                  { user_id: 3, email: 'user3@example.com', signup_date: '2024-01-02', plan_type: 'enterprise', signup_source: 'referral' }
                ]
              },
              {
                name: 'user_activity',
                columns: [
                  { name: 'activity_id', type: 'BIGINT PRIMARY KEY', description: 'Unique activity record' },
                  { name: 'user_id', type: 'INT', description: 'References users.user_id' },
                  { name: 'activity_date', type: 'DATE', description: 'Date of activity' },
                  { name: 'activity_type', type: 'VARCHAR(50)', description: 'Type of activity (login, feature_use, etc.)' },
                  { name: 'duration_minutes', type: 'INT', description: 'Time spent in session' }
                ],
                sampleData: [
                  { activity_id: 1, user_id: 1, activity_date: '2024-01-01', activity_type: 'login', duration_minutes: 45 },
                  { activity_id: 2, user_id: 1, activity_date: '2024-01-08', activity_type: 'feature_use', duration_minutes: 30 },
                  { activity_id: 3, user_id: 2, activity_date: '2024-01-01', activity_type: 'login', duration_minutes: 15 }
                ]
              }
            ]
          }
        },
        { id: 6, text: `Optimize this query for better performance: SELECT * FROM user_events WHERE event_date > '2023-01-01' AND user_id IN (SELECT id FROM users WHERE segment = 'premium')`, category: 'Performance Optimization' }
      ],
      'Case Study': [
        { id: 1, text: `I'll present a business scenario relevant to ${jobTitle} roles. Walk me through your analytical approach.`, category: 'Analytical Framework' },
        { id: 2, text: `How would you structure your analysis to address key business priorities in your ${jobTitle} work?`, category: 'Analysis Structure' },
        { id: 3, text: `What data sources would you need to understand ${context.level.challenges} and how would you validate them?`, category: 'Data Strategy' },
        { id: 4, text: `Walk me through your methodology for tackling complex ${jobTitle} challenges.`, category: 'Methodology' },
        { id: 5, text: `What are the potential limitations when analyzing ${context.level.challenges} and how would you address them?`, category: 'Risk Assessment' },
        { id: 6, text: `How would you present your findings to stakeholders in a ${jobTitle} role?`, category: 'Executive Communication' }
      ],
      'On-site / Final Round': [
        { id: 1, text: `How would you contribute to our team culture and what unique value would you bring as a ${level} ${jobTitle}?`, category: 'Culture Fit' },
        { id: 2, text: `Describe a time when you made a difficult decision while dealing with ${context.level.challenges}.`, category: 'Decision Making' },
        { id: 3, text: `How do you handle feedback and drive continuous improvement in your ${jobTitle} work?`, category: 'Growth Mindset' },
        { id: 4, text: `What questions do you have about this ${jobTitle} role and our team?`, category: 'Engagement' },
        { id: 5, text: `Why should we choose you for this ${jobTitle} position?`, category: 'Closing' }
      ],
      'Executive Interview': [
        { id: 1, text: `Tell me about your leadership philosophy and how it applies to managing teams in ${jobTitle} environments.`, category: 'Leadership' },
        { id: 2, text: `How do you approach strategic planning when dealing with ${context.level.challenges}?`, category: 'Strategy' },
        { id: 3, text: `Describe how you've driven organizational change in your ${jobTitle} experience.`, category: 'Change Management' },
        { id: 4, text: `How do you handle stakeholder conversations when addressing ${context.level.challenges}?`, category: 'Stakeholder Management' },
        { id: 5, text: `What's your vision for this ${jobTitle} role and how would you measure success?`, category: 'Vision' }
      ]
    }

    // Add Product Manager specific case study questions
    if (jobTitle === 'Product Manager' && stage === 'Case Study') {
      baseQuestions['Case Study'] = [
        { id: 1, text: `I'll present a product challenge typical of ${jobTitle} companies. How would you approach prioritizing features given ${context.role.keyResponsibilities}?`, category: 'Product Strategy' },
        { id: 2, text: `How would you design and execute user research to validate assumptions in a ${jobTitle} environment, using your experience with ${context.role.tools}?`, category: 'User Research' },
        { id: 3, text: `What metrics would you track to measure product success given the ${context.level.challenges} of ${jobTitle} roles?`, category: 'Product Metrics' },
        { id: 4, text: `How would you work with engineering and design teams to deliver on ${context.role.keyResponsibilities} as a ${level} ${jobTitle}?`, category: 'Cross-functional Leadership' },
        { id: 5, text: `Design a go-to-market strategy for a new feature, considering the ${context.level.challenges} typical of ${level} ${jobTitle} roles.`, category: 'Go-to-Market' },
        { id: 6, text: `How would you handle competing stakeholder priorities while maintaining focus on ${context.role.keyResponsibilities} as a ${jobTitle}?`, category: 'Stakeholder Management' }
      ]
    }

    return baseQuestions[stage] || baseQuestions['Recruiter Screen']
  }

  const questions: Question[] = customQuestions || getStageSpecificQuestions(stage, jobTitle, level, companyStage)

  // Handle SQL submission
  const handleSqlSubmit = () => {
    if (currentSqlCode.trim() || currentAnswer.trim()) {
      nextQuestion(currentAnswer.trim() || 'SQL code provided')
    }
  }

  // Navigation functions for real-time question control
  const goToNextQuestion = () => {
    console.log('🔄 Manual skip to next question')
    if (questionIndex < questions.length - 1) {
      const currentAnswerText = currentAnswer.trim() || '[Skipped]'
      nextQuestion(currentAnswerText, true) // Bypass processing check for manual navigation
    } else {
      console.log('⚠️ Already at last question')
    }
  }

  const goToPreviousQuestion = () => {
    console.log('🔙 Manual go back to previous question')
    if (questionIndex > 0) {
      // Stop any ongoing processes
      stopListening()
      stopQuestionTimer() // Stop timing current question
      if (forceProgressionTimeoutRef.current) {
        clearTimeout(forceProgressionTimeoutRef.current)
        forceProgressionTimeoutRef.current = null
      }
      
      // Clear processing flags
      isProcessingAnswerRef.current = false
      setIsProcessingAnswer(false)
      
      // Go back to previous question
      const previousIndex = questionIndex - 1
      const previousQuestion = questions[previousIndex]
      
      console.log('📍 Moving back to question:', {
        previousIndex,
        questionId: previousQuestion.id,
        questionText: previousQuestion.text.substring(0, 100) + '...'
      })
      
      // Update state
      setQuestionIndex(previousIndex)
      setCurrentQuestion(previousQuestion)
      
      // Start timing for the previous question
      startQuestionTimer()
      
      // Restore previous answer if it exists in transcript
      const previousEntry = transcript.find(entry => entry.question === previousQuestion.text)
      if (previousEntry) {
        setCurrentAnswer(previousEntry.answer)
        if (isSqlTest && previousEntry.sqlCode) {
          setCurrentSqlCode(previousEntry.sqlCode)
        }
        console.log('📝 Restored previous answer:', previousEntry.answer.substring(0, 50) + '...')
            } else {
        setCurrentAnswer('')
        setCurrentSqlCode('')
        console.log('🧹 No previous answer found, cleared inputs')
      }
      
      // Remove future transcript entries (everything after the current question)
      setTranscript(prev => {
        const cutoffIndex = prev.findIndex(entry => entry.question === previousQuestion.text)
        if (cutoffIndex >= 0) {
          const newTranscript = prev.slice(0, cutoffIndex)
          console.log('✂️ Trimmed transcript from', prev.length, 'to', newTranscript.length, 'entries')
          return newTranscript
        }
        return prev
      })
    } else {
      console.log('⚠️ Already at first question')
    }
  }

  const skipCurrentQuestion = () => {
    console.log('⏭️ Skipping current question')
    const skipText = '[Question Skipped]'
    nextQuestion(skipText, true) // Bypass processing check for skip
  }

  // Continue with the rest of the component logic...
  const nextQuestion = (answerToUse?: string, bypassProcessingCheck = false) => {
    // Stop the current question timer and get the time spent
    const timeSpent = stopQuestionTimer()
    
    // Generate unique transaction ID to prevent duplicates
    const transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('🔄 nextQuestion() called with:', { 
      transactionId,
      answerToUse: answerToUse?.substring(0, 50) + '...', 
      bypassProcessingCheck,
      currentQuestionIndex: questionIndex,
      currentQuestionId: currentQuestion?.id,
      totalQuestions: questions.length,
      isProcessing: isProcessingAnswerRef.current,
      timeSpent
    })
    
    // Check if this transaction was already processed
    if (processedTransactionIds.current.has(transactionId)) {
      console.log('⚠️ Transaction already processed, ignoring:', transactionId)
      return
    }
    
    // ENHANCED duplicate call prevention with stricter timing
    const callTimestamp = Date.now()
    const lastCallTimestamp = lastCallTimestampRef.current
    
    if (callTimestamp - lastCallTimestamp < 500) { // Increased from 100ms to 500ms
      console.log('⚠️ Duplicate call detected within 500ms, ignoring')
      return
    }
    
    // Strict processing flag check - no bypassing for regular calls
    if (isProcessingAnswerRef.current && !bypassProcessingCheck) {
      console.log('⚠️ Already processing answer transition, ignoring duplicate call')
      return
    }
    
    // Mark transaction as processed IMMEDIATELY
    processedTransactionIds.current.add(transactionId)
    currentTransactionId.current = transactionId
    
    // Set processing flag IMMEDIATELY to block any other calls
    isProcessingAnswerRef.current = true
    setIsProcessingAnswer(true)
    lastCallTimestampRef.current = callTimestamp
    console.log('🔒 Setting processing flag to true with transaction:', transactionId)
    
    const effectiveAnswer = answerToUse || currentAnswer.trim()
    console.log('📝 Effective answer to save:', effectiveAnswer)
    
    if (!effectiveAnswer.trim()) {
      console.log('⚠️ No answer provided, cannot advance to next question')
      isProcessingAnswerRef.current = false // Reset flag
      setIsProcessingAnswer(false)
      processedTransactionIds.current.delete(transactionId) // Remove from processed
      currentTransactionId.current = null
      return
    }
    
    if (forceProgressionTimeoutRef.current) {
      clearTimeout(forceProgressionTimeoutRef.current)
      forceProgressionTimeoutRef.current = null
      console.log('🔄 Cleared smart progression timeout')
    }
    
    // Use functional update to ensure we have the most current state
    setQuestionIndex(currentIndex => {
      // CRITICAL: Double-check transaction hasn't been processed in a different call
      if (currentTransactionId.current !== transactionId) {
        console.log('⚠️ Transaction ID mismatch, another call already processed:', { 
          current: currentTransactionId.current, 
          this: transactionId 
        })
        return currentIndex // Don't change anything
      }
      
      const actualCurrentQuestion = questions[currentIndex]
      console.log('📊 Processing question transition:', { 
        transactionId,
        currentIndex,
        nextIndex: currentIndex + 1,
        actualCurrentQuestionId: actualCurrentQuestion?.id,
        currentQuestionStateId: currentQuestion?.id,
        effectiveAnswerLength: effectiveAnswer.length,
        hasAnswer: !!effectiveAnswer,
        passedAnswer: !!answerToUse,
        totalQuestions: questions.length,
        isLastQuestion: currentIndex >= questions.length - 1,
        timeSpent
      })

      // Handle interview completion
      if (currentIndex >= questions.length - 1) {
        console.log('✅ Interview complete - this was the last question')
        setIsInterviewComplete(true)
        stopListening()
        stopTotalTimer() // Stop the overall interview timer
        
        // Create final transcript entry with unique ID and time tracking
        const finalTranscriptEntry: TranscriptEntry = {
          question: actualCurrentQuestion.text,
          answer: effectiveAnswer,
          timestamp: new Date(),
          timeSpent, // Include time spent on this question
          ...(isSqlTest && currentSqlCode ? { sqlCode: currentSqlCode } : {})
        }
        
        // Update transcript with final entry and generate feedback
        setTranscript(prev => {
          // Prevent duplicate entries by checking if this exact entry already exists
          const isDuplicate = prev.some(entry => 
            entry.question === finalTranscriptEntry.question && 
            entry.answer === finalTranscriptEntry.answer &&
            Math.abs(entry.timestamp.getTime() - finalTranscriptEntry.timestamp.getTime()) < 1000
          )
          
          if (isDuplicate) {
            console.log('⚠️ Duplicate final transcript entry detected, skipping')
            return prev
          }
          
          const finalTranscript = [...prev, finalTranscriptEntry]
          console.log('📝 Final transcript length:', finalTranscript.length)
          
          // Generate feedback with complete transcript
          setTimeout(() => {
            generateFeedback(finalTranscript)
          }, 100)
          
          return finalTranscript
        })
        
        // Clear form data
        setCurrentAnswer('')
        setCurrentSqlCode('')
        console.log('🧹 Cleared current answer and SQL code for interview completion')
        
        // Reset processing flag
        setTimeout(() => {
          isProcessingAnswerRef.current = false
          setIsProcessingAnswer(false)
          currentTransactionId.current = null
          console.log('🔓 Cleared processing flag for interview completion')
        }, 200)
        
        return currentIndex // Stay on last question
      }

      // Create transcript entry for current question with unique identifier and time tracking
      const newTranscriptEntry: TranscriptEntry = {
        question: actualCurrentQuestion.text,
        answer: effectiveAnswer,
        timestamp: new Date(),
        timeSpent, // Include time spent on this question
        ...(isSqlTest && currentSqlCode ? { sqlCode: currentSqlCode } : {})
      }

      console.log('💾 Saving transcript entry:', {
        transactionId,
        questionId: actualCurrentQuestion.id,
        answerLength: effectiveAnswer.length,
        hasSQL: !!currentSqlCode,
        timeSpent
      })
      
      // Update transcript with duplicate prevention
      setTranscript(prev => {
        // Prevent duplicate entries by checking if this exact entry already exists
        const isDuplicate = prev.some(entry => 
          entry.question === newTranscriptEntry.question && 
          entry.answer === newTranscriptEntry.answer &&
          Math.abs(entry.timestamp.getTime() - newTranscriptEntry.timestamp.getTime()) < 1000
        )
        
        if (isDuplicate) {
          console.log('⚠️ Duplicate transcript entry detected, skipping:', {
            transactionId,
            question: newTranscriptEntry.question.substring(0, 50),
            answer: newTranscriptEntry.answer.substring(0, 30)
          })
            return prev
        }
        
        const updated = [...prev, newTranscriptEntry]
        console.log('📝 Updated transcript length:', updated.length, 'for transaction:', transactionId)
        return updated
      })
      
      // Clear current answer and SQL code
      setCurrentAnswer('')
      setCurrentSqlCode('')
      console.log('🧹 Cleared current answer and SQL code')
      
      // Move to next question
      const nextIndex = currentIndex + 1
      const nextQuestion = questions[nextIndex]
      console.log('➡️ Moving to next question:', { 
        transactionId,
        nextIndex, 
        nextQuestionId: nextQuestion?.id,
        nextQuestionText: nextQuestion?.text?.substring(0, 100) + '...'
      })
      
      // Update current question
      setCurrentQuestion(nextQuestion)
      
      // Start timer for the new question
      startQuestionTimer()
      
      // Reset processing flag after state updates complete
                        setTimeout(() => {
                          isProcessingAnswerRef.current = false
        setIsProcessingAnswer(false)
        currentTransactionId.current = null
        console.log('🔓 Cleared processing flag after successful transition for transaction:', transactionId)
      }, 200) // Increased timeout to ensure all state updates complete
      
      return nextIndex
    })
  }

  const generateFeedback = async (fullTranscript: TranscriptEntry[]) => {
    setFeedback('Generating AI feedback...')
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: fullTranscript,
          jobTitle,
          level,
          companyStage,
          stage
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate feedback')
      }

      const data = await response.json()
      setFeedback(data.feedback)
    } catch (error) {
      console.error('Error generating feedback:', error)
      setFeedback('Sorry, we encountered an error generating your AI feedback. Please try again later.')
    }
  }

  const startInterview = async () => {
    console.log('Starting interview...')
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('Microphone permission granted')
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('Microphone permission denied:', error)
      alert('Microphone access is required for the interview. Please allow microphone access and try again.')
          return
        }
        
    setCountdown(3)
    setIsInterviewStarted(false)
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          setIsInterviewStarted(true)
          setAutoMode(true)
          setCountdown(0)
          // Start the interview timers
          startTotalTimer()
          startQuestionTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Ensure currentQuestion stays in sync with questionIndex
  useEffect(() => {
    if (questions.length > 0 && questionIndex >= 0 && questionIndex < questions.length) {
      const expectedQuestion = questions[questionIndex]
      if (!currentQuestion || currentQuestion.id !== expectedQuestion.id) {
        console.log('🔧 Syncing currentQuestion with questionIndex:', questionIndex, expectedQuestion.text)
        setCurrentQuestion(expectedQuestion)
      }
    }
  }, [questionIndex, questions, currentQuestion])

  useEffect(() => {
    if (questions.length > 0 && !currentQuestion) {
      console.log('🔧 Setting initial question:', questions[0].text)
      setCurrentQuestion(questions[0])
    }
  }, [questions, currentQuestion])

  // Speech Recognition Functions
  const startListening = () => {
    if (!isInterviewStarted || isListening || botIsSpeakingRef.current) {
      console.log('Cannot start listening - conditions not met')
      return
    }

    console.log('🎤 Starting speech recognition...')
    setIsListening(true)
    setIsPreparingToListen(false)

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition

      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        console.log('🎤 Speech recognition started')
        setIsRecording(true)
        
        // Auto-stop after 2 minutes max
        if (maxRecordingTimeoutRef.current) {
          clearTimeout(maxRecordingTimeoutRef.current)
        }
        maxRecordingTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Max recording time reached, stopping...')
          stopListening()
        }, 120000) // 2 minutes
      }

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (finalTranscript) {
          console.log('📝 Final transcript:', finalTranscript)
          setCurrentAnswer(prev => {
            const newAnswer = (prev + ' ' + finalTranscript).trim()
            
            // Clear and reset silence timeout on new speech
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current)
              silenceTimeoutRef.current = null
            }
            
            // Auto-advance after 3 seconds of silence - but only if not already processing
            silenceTimeoutRef.current = setTimeout(() => {
              if (isListeningRef.current && 
                  !botIsSpeakingRef.current && 
                  !isProcessingAnswerRef.current && 
                  newAnswer.trim() && 
                  isInterviewStarted && 
                  !isInterviewComplete) {
                console.log('🔇 Silence detected, auto-advancing with answer:', newAnswer.trim())
                stopListening()
                // Use a longer delay to ensure clean state transition
      setTimeout(() => {
                  // Double-check conditions before calling nextQuestion
                  if (!isProcessingAnswerRef.current && newAnswer.trim()) {
                    nextQuestion(newAnswer.trim())
            } else {
                    console.log('⚠️ Skipping auto-advance - conditions changed')
                  }
                }, 800) // Increased from 500ms to 800ms for better reliability
              }
            }, 3000)
            
            return newAnswer
          })
        }
      }

      recognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error)
        setIsListening(false)
        setIsRecording(false)
        
        if (event.error === 'no-speech') {
          console.log('⚠️ No speech detected, will retry...')
          setTimeout(() => {
            if (isInterviewStarted && !botIsSpeakingRef.current) {
              startListening()
            }
          }, 1000)
        }
      }

      recognition.onend = () => {
        console.log('🎤 Speech recognition ended')
        setIsRecording(false)
        
        if (isListeningRef.current && isInterviewStarted && !botIsSpeakingRef.current) {
          console.log('🔄 Restarting speech recognition...')
          setTimeout(() => {
            if (isListeningRef.current) {
              startListening()
            }
          }, 100)
        }
      }

      try {
        recognition.start()
      } catch (error) {
        console.error('❌ Error starting recognition:', error)
        setIsListening(false)
      setIsRecording(false)
    }
    } else {
      console.error('❌ Speech recognition not supported')
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.')
    }
  }

  const stopListening = () => {
    console.log('⏹️ Stopping speech recognition...')
    setIsListening(false)
    setIsRecording(false)
    
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

  // Bot Speaking Callbacks
  const handleBotStartedSpeaking = () => {
    console.log('🤖 Bot started speaking - stopping microphone')
    botIsSpeakingRef.current = true
    stopListening()
  }

  const handleBotDoneSpeaking = () => {
    console.log('🤖 Bot finished speaking - starting microphone in 1 second')
    botIsSpeakingRef.current = false
    
    if (isInterviewStarted && !isInterviewComplete) {
      setIsPreparingToListen(true)
      setTimeout(() => {
        if (!botIsSpeakingRef.current && isInterviewStarted && !isInterviewComplete) {
          startListening()
        }
      }, 1000) // Give user 1 second to prepare
    }
  }

  // Helper function to parse and format feedback
  const parseFeedback = (feedbackText: string) => {
    if (!feedbackText || feedbackText === 'Generating AI feedback...') {
      return null
    }

    const sections = feedbackText.split('\n\n')
    return {
      title: sections[0] || 'Interview Performance Analysis',
      content: feedbackText
    }
  }

  // Helper function to render formatted feedback
  const renderFormattedFeedback = (feedbackText: string) => {
    if (!feedbackText || feedbackText === 'Generating AI feedback...') {
      return null
    }

    const lines = feedbackText.split('\n').filter(line => line.trim())
    const sections: { [key: string]: string[] } = {}
    let currentSection = 'General'
    
    lines.forEach(line => {
      const trimmedLine = line.trim()
      
      // Check if it's a section header
      if (trimmedLine.includes('Overall Assessment') || 
          trimmedLine.includes('Performance Breakdown') ||
          trimmedLine.includes('Strengths') ||
          trimmedLine.includes('Areas for Improvement') ||
          trimmedLine.includes('Question-by-Question Analysis') ||
          trimmedLine.includes('Interview Stage Recommendations') ||
          trimmedLine.includes('Interview Readiness Assessment') ||
          trimmedLine.includes('Sample Improved Responses')) {
        currentSection = trimmedLine
        sections[currentSection] = []
      } else if (trimmedLine.startsWith('- ') || trimmedLine.match(/^\d+\./)) {
        // It's a bullet point or numbered item
        if (!sections[currentSection]) sections[currentSection] = []
        sections[currentSection].push(trimmedLine)
      } else if (trimmedLine.length > 0 && !trimmedLine.includes('Interview Performance Analysis')) {
        // It's regular content
        if (!sections[currentSection]) sections[currentSection] = []
        sections[currentSection].push(trimmedLine)
      }
    })

    return (
      <div className="space-y-8">
        {Object.entries(sections).map(([sectionTitle, sectionContent], index) => {
          if (sectionContent.length === 0) return null
          
          const isScoreSection = sectionTitle.includes('Performance Breakdown')
          const isOverallSection = sectionTitle.includes('Overall Assessment')
          
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                {isOverallSection && <span className="text-2xl mr-2">📊</span>}
                {isScoreSection && <span className="text-2xl mr-2">🎯</span>}
                {sectionTitle.includes('Strengths') && <span className="text-2xl mr-2">💪</span>}
                {sectionTitle.includes('Areas for Improvement') && <span className="text-2xl mr-2">🎯</span>}
                {sectionTitle.includes('Question-by-Question') && <span className="text-2xl mr-2">📝</span>}
                {sectionTitle.includes('Recommendations') && <span className="text-2xl mr-2">🚀</span>}
                {sectionTitle.includes('Readiness') && <span className="text-2xl mr-2">✅</span>}
                {sectionTitle.includes('Sample') && <span className="text-2xl mr-2">💡</span>}
                {sectionTitle}
              </h3>
              
              <div className="space-y-3">
                {sectionContent.map((item, itemIndex) => {
                  // Handle score items specially
                  if (item.includes(': X/10') || item.includes('Score:')) {
                    return (
                      <div key={itemIndex} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                        <span className="text-gray-700 font-medium">{item.replace('- ', '').replace(': X/10', '')}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full">
                            <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style={{width: '70%'}}></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-600">?/10</span>
                        </div>
                      </div>
                    )
                  }
                  
                  // Handle bullet points
                  if (item.startsWith('- ')) {
                    return (
                      <div key={itemIndex} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-700 leading-relaxed">{item.substring(2)}</span>
                      </div>
                    )
                  }
                  
                  // Handle numbered items
                  if (item.match(/^\d+\./)) {
                    return (
                      <div key={itemIndex} className="flex items-start space-x-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-blue-50">
                        <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {item.match(/^(\d+)/)?.[1]}
                        </div>
                        <span className="text-gray-700 leading-relaxed">{item.replace(/^\d+\.\s*/, '')}</span>
                      </div>
                    )
                  }
                  
                  // Regular content
                  return (
                    <p key={itemIndex} className="text-gray-700 leading-relaxed p-2">
                      {item}
                    </p>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (isInterviewComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Interview Complete!</h1>
            
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Your Responses:</h2>
              <div className="space-y-4">
                {transcript.map((entry, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-800">{entry.question}</p>
                      {entry.timeSpent && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500 flex-shrink-0 ml-4">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatTime(entry.timeSpent)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{entry.answer}</p>
                    {entry.sqlCode && (
                      <div className="mt-2 p-3 bg-gray-100 rounded-md">
                        <p className="text-sm font-medium text-gray-700 mb-1">SQL Code:</p>
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{entry.sqlCode}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    🎯 AI Performance Analysis
                  </h2>
                  <p className="text-gray-600">Advanced interview coaching powered by artificial intelligence</p>
                </div>
                <button
                  onClick={() => generateFeedback(transcript)}
                  disabled={feedback === 'Generating AI feedback...'}
                  className="group relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                >
                  <div className="flex items-center space-x-2">
                    {feedback === 'Generating AI feedback...' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 transition-transform group-hover:rotate-180 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Generate New Analysis</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
              
              <div className="relative">
                {feedback === 'Generating AI feedback...' ? (
                  <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 p-8 rounded-2xl border border-purple-100 shadow-lg">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping"></div>
                        <div className="absolute inset-2 rounded-full border-4 border-blue-200 animate-ping animation-delay-75"></div>
                        <div className="relative w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">AI Analysis In Progress</h3>
                        <p className="text-gray-600 mb-4">Our advanced AI is analyzing your interview performance...</p>
                        
                        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-100"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce animation-delay-200"></div>
                          </div>
                          <span>Processing responses and generating insights</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : feedback && feedback !== 'Click "Generate AI Analysis" to get detailed feedback on your interview performance.' ? (
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-8 rounded-2xl border border-gray-200 shadow-lg">
                    <div className="relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full opacity-20 -mr-16 -mt-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-100 to-indigo-100 rounded-full opacity-20 -ml-12 -mb-12"></div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center mb-6">
                          <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                          <span className="text-sm font-medium text-gray-600">Analysis Complete</span>
                        </div>
                        
                        {renderFormattedFeedback(feedback)}
                        </div>
                      </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-8 rounded-2xl border border-gray-200 shadow-lg">
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 text-lg">Click "Generate New Analysis" to get detailed feedback on your interview performance.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start New Interview
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Interview Setup */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Interview Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Position:</span>
                  <span className="ml-2 text-gray-800">{jobTitle}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Level:</span>
                  <span className="ml-2 text-gray-800">{level}</span>
                </div>
                  <div>
                  <span className="font-medium text-gray-600">Stage:</span>
                  <span className="ml-2 text-gray-800">{stage}</span>
                  </div>
                <div>
                  <span className="font-medium text-gray-600">Company Stage:</span>
                  <span className="ml-2 text-gray-800">{companyStage}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Duration:</span>
                  <span className="ml-2 text-gray-800">{duration} minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Interview Content */}
          <div className="lg:col-span-2">
            {/* Interview Start Button */}
            {!isInterviewStarted && !isInterviewComplete && countdown === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Ready to Start Your Interview?</h2>
                <p className="text-gray-600 mb-6">
                  Click the button below to begin your {jobTitle} interview. 
                  {isSqlTest ? ' This is a SQL Test - you\'ll be able to write and submit SQL code for each question.' : ' The AI interviewer will ask you questions, and you can respond naturally using voice.'}
                </p>
                <button
                  onClick={startInterview}
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {isSqlTest ? '💻 Start SQL Test' : '🎤 Start Interview'}
                </button>
                <p className="text-sm text-gray-500 mt-4">
                  {isSqlTest ? 'You\'ll have a code editor to write your SQL queries' : 'Make sure your microphone is enabled for the best experience'}
                </p>
              </div>
            )}

            {/* Countdown Display */}
            {countdown > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Get Ready!</h2>
                <div className="text-6xl font-bold text-blue-600 mb-4 animate-pulse">
                  {countdown}
                </div>
                <p className="text-gray-600">
                  The {isSqlTest ? 'SQL test' : 'interview'} will begin in {countdown} second{countdown !== 1 ? 's' : ''}...
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {isSqlTest ? 'Prepare to write SQL queries' : 'Prepare to answer the first question'}
                </p>
              </div>
            )}

            {/* Current Question */}
            {currentQuestion && isInterviewStarted && countdown === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Question {questionIndex + 1} of {questions.length}
                  </h2>
                    {/* Timer Display */}
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-600">Total:</span>
                          <span className={`font-mono font-semibold ${totalTimeRemaining <= 300 ? 'text-red-600' : totalTimeRemaining <= 600 ? 'text-orange-600' : 'text-blue-600'}`}>
                            {formatTime(totalTimeRemaining)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-600">Question:</span>
                          <span className="font-mono font-semibold text-green-600">
                            {formatTime(currentQuestionTime)}
                          </span>
                        </div>
                      </div>
                      {totalTimeRemaining <= 300 && (
                        <div className="flex items-center space-x-1 text-red-600 animate-pulse">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-sm font-medium">Time running low!</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {currentQuestion.category}
                  </span>
                </div>
                {/* SQL Test Interface */}
                {isSqlTest ? (
                  <div className="space-y-4">
                    {/* Navigation Controls for SQL Test */}
                    <div className="bg-gray-50 px-6 py-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={goToPreviousQuestion}
                        disabled={questionIndex === 0 || isProcessingAnswer}
                        className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Previous</span>
                      </button>
                      
                      <div className="text-sm text-gray-600">
                            {questionIndex === 0 && "First SQL question"}
                        {questionIndex > 0 && questionIndex < questions.length - 1 && "Navigate freely"}
                            {questionIndex === questions.length - 1 && "Last SQL question"}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={skipCurrentQuestion}
                        disabled={isProcessingAnswer}
                        className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                            <span>Skip Question</span>
                      </button>
                      
                      <button
                        onClick={goToNextQuestion}
                        disabled={questionIndex >= questions.length - 1 || isProcessingAnswer}
                        className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                            <span>Next Question</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                    {/* Question Text */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">💭 SQL Question</h3>
                      <p className="text-gray-800 text-base leading-relaxed">{currentQuestion.text}</p>
                    </div>
                    
                    {/* Display table schemas if available */}
                    {currentQuestion?.tableSchema && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h3 className="text-lg font-semibold text-blue-800 mb-3">📊 Table Schemas</h3>
                  <div className="space-y-4">
                          {currentQuestion.tableSchema.tables.map((table, tableIndex) => (
                            <div key={tableIndex} className="bg-white border border-blue-200 rounded-lg p-4">
                              <h4 className="text-md font-bold text-blue-700 mb-2">{table.name}</h4>
                              
                              {/* Table structure */}
                              <div className="overflow-x-auto mb-3">
                                <table className="min-w-full text-sm border-collapse border border-gray-300">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="border border-gray-300 px-3 py-2 text-left font-medium">Column</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left font-medium">Type</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left font-medium">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {table.columns.map((column, colIndex) => (
                                      <tr key={colIndex} className={colIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="border border-gray-300 px-3 py-2 font-mono text-blue-600">{column.name}</td>
                                        <td className="border border-gray-300 px-3 py-2 font-mono text-green-600">{column.type}</td>
                                        <td className="border border-gray-300 px-3 py-2 text-gray-700">{column.description || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Sample data */}
                              {table.sampleData && table.sampleData.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Sample Data:</h5>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs border-collapse border border-gray-300">
                                      <thead>
                                        <tr className="bg-gray-100">
                                          {Object.keys(table.sampleData[0]).map((key, keyIndex) => (
                                            <th key={keyIndex} className="border border-gray-300 px-2 py-1 text-left font-medium">{key}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {table.sampleData.map((row, rowIndex) => (
                                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            {Object.values(row).map((value, valueIndex) => (
                                              <td key={valueIndex} className="border border-gray-300 px-2 py-1 font-mono text-xs">
                                                {typeof value === 'string' ? `"${value}"` : String(value)}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your SQL Query:
                      </label>
                      <textarea
                        value={currentSqlCode}
                        onChange={(e) => setCurrentSqlCode(e.target.value)}
                        placeholder="-- Write your SQL query here
SELECT ...
FROM ...
WHERE ..."
                        className="w-full h-40 p-4 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Explanation (Optional):
                      </label>
                      <textarea
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Explain your approach, reasoning, or any assumptions..."
                        className="w-full h-24 p-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                    <button
                      onClick={handleSqlSubmit}
                      disabled={!currentSqlCode.trim()}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Submit SQL Answer</span>
                    </button>
                      
                      {/* Quick navigation buttons */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Quick actions:</span>
                        <button
                          onClick={skipCurrentQuestion}
                          disabled={isProcessingAnswer}
                          className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Skip
                        </button>
                        {questionIndex < questions.length - 1 && (
                          <button
                            onClick={goToNextQuestion}
                            disabled={isProcessingAnswer}
                            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Regular Interview Interface for non-SQL stages */
                  <div className="space-y-6">
                    {/* AI Interview Coach Component with Navigation Controls */}
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                      {/* Navigation Controls - Integrated Header */}
                      <div className="bg-gray-50 px-6 py-4 rounded-t-lg border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={goToPreviousQuestion}
                              disabled={questionIndex === 0 || isProcessingAnswer}
                              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                              </svg>
                              <span>Previous</span>
                            </button>
                            
                            <div className="text-sm text-gray-600">
                              {questionIndex === 0 && "First question"}
                              {questionIndex > 0 && questionIndex < questions.length - 1 && "Navigate freely"}
                              {questionIndex === questions.length - 1 && "Last question"}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={skipCurrentQuestion}
                              disabled={isProcessingAnswer}
                              className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                              <span>Skip</span>
                            </button>
                            
                            <button
                              onClick={goToNextQuestion}
                              disabled={questionIndex >= questions.length - 1 || isProcessingAnswer}
                              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              <span>Next</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* AI Interview Coach Content */}
                      <div className="p-6">
                <InterviewBot
                  room={liveKitRoom}
                  currentQuestion={currentQuestion}
                  isConnected={isLiveKitConnected}
                  isInterviewStarted={isInterviewStarted}
                  onBotDoneSpeaking={handleBotDoneSpeaking}
                      onBotStartedSpeaking={handleBotStartedSpeaking}
                    />
                      </div>
                    </div>

                    {/* Voice Recording Status */}
                    <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-200">
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
                      <div className="flex items-center justify-center py-6">
                        <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isRecording 
                            ? 'bg-red-100 border-4 border-red-500 animate-pulse' 
                            : isListening 
                            ? 'bg-blue-100 border-4 border-blue-500 animate-pulse'
                            : isPreparingToListen
                            ? 'bg-yellow-100 border-4 border-yellow-500 animate-pulse'
                            : 'bg-gray-100 border-4 border-gray-300'
                        }`}>
                          <svg className={`w-10 h-10 ${
                            isRecording 
                              ? 'text-red-600' 
                              : isListening 
                              ? 'text-blue-600'
                              : isPreparingToListen
                              ? 'text-yellow-600'
                              : 'text-gray-400'
                          }`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                          
                          {/* Pulse rings for recording */}
                          {isRecording && (
                            <>
                              <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
                              <div className="absolute inset-2 rounded-full border-4 border-red-200 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                            </>
                          )}
                          </div>
                      </div>

                      {/* Status Message */}
                      <div className="text-center">
                        {isRecording && (
                          <p className="text-red-600 font-medium">🎤 Recording your response...</p>
                        )}
                        {isListening && !isRecording && (
                          <p className="text-blue-600 font-medium">👂 Listening for your voice...</p>
                        )}
                        {isPreparingToListen && (
                          <p className="text-yellow-600 font-medium">⏳ Get ready to speak...</p>
                        )}
                        {!isListening && !isRecording && !isPreparingToListen && (
                          <p className="text-gray-500">⏸️ Microphone inactive</p>
                        )}
                      </div>
                    </div>

                    {/* Chat Interface - Conversation History */}
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                      <div className="bg-gray-50 px-4 py-3 rounded-t-lg border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                          💬 Interview Conversation
                          <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                            {transcript.length} responses
                          </span>
                        </h3>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                        {/* Previous Q&As */}
                        {transcript.map((entry, index) => (
                          <div key={index} className="space-y-3">
                            {/* Question */}
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1 bg-blue-50 rounded-lg p-3">
                                <p className="text-gray-800">{entry.question}</p>
                                <span className="text-xs text-gray-500 mt-1 block">AI Interviewer</span>
                              </div>
                            </div>
                            
                            {/* Answer */}
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1 bg-green-50 rounded-lg p-3">
                                <p className="text-gray-800">{entry.answer}</p>
                                {entry.sqlCode && (
                                  <div className="mt-2 p-2 bg-gray-100 rounded border">
                                    <p className="text-xs font-medium text-gray-600 mb-1">SQL Code:</p>
                                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono">{entry.sqlCode}</pre>
                    </div>
                  )}
                                <span className="text-xs text-gray-500 mt-1 block">You • {entry.timestamp.toLocaleTimeString()}</span>
                </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Current Question */}
                        <div className="space-y-3 border-t border-gray-200 pt-4">
                          {/* Current Question */}
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1 bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
                              <p className="text-gray-800 font-medium">{currentQuestion.text}</p>
                              <span className="text-xs text-blue-600 mt-1 block font-medium">AI Interviewer • Current Question</span>
                            </div>
                          </div>
                          
                          {/* Current Answer (if any) */}
                {currentAnswer.trim() && (
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="flex-1 bg-green-50 rounded-lg p-3 border-2 border-green-200">
                                <p className="text-gray-800">{currentAnswer}</p>
                                <span className="text-xs text-green-600 mt-1 block font-medium">
                                  You • Speaking... 
                                  {isListening && <span className="animate-pulse"> 🎤</span>}
                                </span>
                              </div>
                  </div>
                )}
                          
                          {/* Waiting for response indicator */}
                          {!currentAnswer.trim() && isListening && (
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                              </div>
                              <div className="flex-1 bg-gray-50 rounded-lg p-3 border-2 border-dashed border-gray-300">
                                <p className="text-gray-500 italic">Waiting for your response...</p>
                                <span className="text-xs text-gray-400 mt-1 block">Speak when you're ready</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Manual Controls */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Manual Controls</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Voice Recording Controls */}
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600 font-medium">Recording</p>
                          <div className="flex space-x-2">
                            <button
                              onClick={startListening}
                              disabled={isListening || !isInterviewStarted}
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

                        {/* Navigation Controls */}
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600 font-medium">Navigation</p>
                          <div className="flex space-x-2">
                            <button
                              onClick={goToPreviousQuestion}
                              disabled={questionIndex === 0 || isProcessingAnswer}
                              className="flex-1 bg-gray-600 text-white px-3 py-2 rounded text-xs hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              ⬅️ Back
                            </button>
                            <button
                              onClick={goToNextQuestion}
                              disabled={questionIndex >= questions.length - 1 || isProcessingAnswer}
                              className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-xs hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              ➡️ Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {isInterviewStarted && countdown === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Progress</h3>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {questionIndex + 1} of {questions.length} questions completed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 
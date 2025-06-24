'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TTSTestPanel } from '../components/TTSTestPanel'

const jobTitles = [
  'Data Analyst',
  'Product Manager'
]

const levels = [
  'Entry Level (0-2 years)',
  'Mid Level (3-5 years)',
  'Senior Level (6-10 years)',
  'Staff/Principal (10+ years)',
  'Executive/Leadership'
]

const companyStages = [
  'Early (Pre-Seed, Seed)',
  'Growth Stage (Series A/B/C/D+)',
  'Late Stage: Pre-IPO / Mature Private',
  'Post-Exit: Public Company',
  'Mega Cap / Big Tech (FAANG)'
]

const getInterviewStages = (jobTitle: string): string[] => {
  switch (jobTitle) {
    case 'Data Analyst':
      return [
        'Recruiter Screen',
        'Hiring Manager Screen',
        'SQL Test',
        'Technical Interview',
        'Case Study',
        'On-site / Final Round'
      ]
    case 'Product Manager':
      return [
        'Recruiter Screen',
        'Hiring Manager Screen',
        'SQL Test',
        'Technical Interview',
        'Case Study',
        'Executive Interview',
        'On-site / Final Round'
      ]
    default:
      return [
        'Recruiter Screen',
        'Hiring Manager Screen',
        'SQL Test',
        'Technical Interview',
        'Case Study',
        'On-site / Final Round',
        'Executive Interview'
      ]
  }
}

export default function InterviewSetup() {
  const router = useRouter()
  const [jobTitle, setJobTitle] = useState('')
  const [level, setLevel] = useState('')
  const [companyStage, setCompanyStage] = useState('')
  const [duration, setDuration] = useState(15)
  const [stage, setStage] = useState('')
  const [showTTSTest, setShowTTSTest] = useState(false)
  
  // Custom job practice states
  const [practiceMode, setPracticeMode] = useState<'standard' | 'custom'>('standard')
  const [customJobInputType, setCustomJobInputType] = useState<'title' | 'description' | 'file' | 'url'>('title')
  const [customJobTitle, setCustomJobTitle] = useState('')
  const [customJobDescription, setCustomJobDescription] = useState('')
  const [customJobUrl, setCustomJobUrl] = useState('')
  const [customJobFile, setCustomJobFile] = useState<File | null>(null)
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  
  // Auto-detection states
  const [detectedAttributes, setDetectedAttributes] = useState<any>({})
  const [showDetectedValues, setShowDetectedValues] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [isValidatingUrl, setIsValidatingUrl] = useState(false)
  const [error, setError] = useState('')

  // Get stages based on selected job title
  const availableStages = getInterviewStages(jobTitle)

  // Reset stage if it's not available for the new job title
  useEffect(() => {
    if (jobTitle && stage && !availableStages.includes(stage)) {
      setStage('')
    }
  }, [jobTitle, stage, availableStages])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type and size
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
      const maxSize = 5 * 1024 * 1024 // 5MB
      
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a PDF, DOC, DOCX, or TXT file')
        return
      }
      
      if (file.size > maxSize) {
        alert('File size must be less than 5MB')
        return
      }
      
      setCustomJobFile(file)
    }
  }

  const analyzeJobContent = async () => {
    // Get job content based on input type
    let jobContent = ''
    
    switch (customJobInputType) {
      case 'title':
        if (!customJobTitle.trim()) return
        jobContent = customJobTitle
        break
      case 'description':
        if (!customJobDescription.trim()) return
        jobContent = customJobDescription
        break
      case 'file':
        if (!customJobFile) return
        // For file analysis, we'll do it during submission since we need server-side processing
        return
      case 'url':
        if (!customJobUrl.trim()) return
        // Validate URL format
        try {
          new URL(customJobUrl)
        } catch {
          setUrlError('Please enter a valid URL')
          return
        }
        setUrlError('')
        // For URL analysis, we'll do it during submission since we need server-side processing
        return
    }
    
    if (!jobContent.trim()) return
    
    setIsAnalyzing(true)
    
    try {
      const formData = new FormData()
      formData.append('inputType', customJobInputType)
      formData.append('level', '') // Empty to trigger auto-detection
      formData.append('companyStage', '')
      formData.append('stage', '')
      formData.append('duration', '15') // Dummy value
      
      if (customJobInputType === 'title') {
        formData.append('jobTitle', customJobTitle)
      } else if (customJobInputType === 'description') {
        formData.append('jobDescription', customJobDescription)
      }

      const response = await fetch('/api/generate-custom-questions', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const { detectedAttributes: detected } = await response.json()
        if (detected) {
          setDetectedAttributes(detected)
          setShowDetectedValues(true)
          
          // Auto-fill the form with detected values
          if (detected.level && !level) setLevel(detected.level)
          if (detected.companyStage && !companyStage) setCompanyStage(detected.companyStage)
          if (detected.stage && !stage) setStage(detected.stage)
        }
      } else {
        const result = await response.json()
        
        if (!response.ok) {
          console.error('❌ API Error:', result)
          setError(result.error || 'Failed to generate questions')
          if (result.details) {
            setError(`${result.error}\n\n${result.details}`)
          }
          return
        }
      }
    } catch (error) {
      console.error('Error analyzing job content:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // URL validation function
  const validateJobUrl = async (url: string) => {
    if (!url.trim()) {
      setUrlError('')
      return
    }
    
    try {
      new URL(url)
      setUrlError('')
      setIsValidatingUrl(true)
      
      // Quick validation by trying to fetch headers
      const response = await fetch('/api/validate-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      
      if (!response.ok) {
        const { error } = await response.json()
        setUrlError(error || 'Unable to access this URL')
      } else {
        setUrlError('')
      }
    } catch {
      setUrlError('Please enter a valid URL')
    } finally {
      setIsValidatingUrl(false)
    }
  }

  // Trigger analysis when job content changes (with debounce)
  useEffect(() => {
    if (practiceMode === 'custom' && (customJobInputType === 'title' || customJobInputType === 'description')) {
      const timer = setTimeout(() => {
        analyzeJobContent()
      }, 1000) // 1 second debounce
      
      return () => clearTimeout(timer)
    }
  }, [customJobTitle, customJobDescription, customJobInputType, practiceMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (practiceMode === 'standard') {
      // Standard interview flow
      if (!jobTitle || !level || !companyStage || !stage) {
        alert('Please fill in all required fields')
        return
      }

      const params = new URLSearchParams({
        jobTitle,
        level,
        companyStage,
        duration: duration.toString(),
        stage
      })

      router.push(`/interview?${params.toString()}`)
    } else {
      // Custom job practice flow - fields are now optional
      // Validate custom job input
      let hasValidInput = false
      switch (customJobInputType) {
        case 'title':
          hasValidInput = !!customJobTitle.trim()
          break
        case 'description':
          hasValidInput = !!customJobDescription.trim()
          break
        case 'file':
          hasValidInput = !!customJobFile
          break
        case 'url':
          hasValidInput = !!customJobUrl.trim()
          break
      }

      if (!hasValidInput) {
        alert('Please provide job information using one of the input methods')
        return
      }

      // Generate custom questions
      setIsGeneratingQuestions(true)
      
      try {
        const formData = new FormData()
        formData.append('inputType', customJobInputType)
        // Send empty values to let the API auto-detect and use defaults
        formData.append('level', level || '')
        formData.append('companyStage', companyStage || '')
        formData.append('stage', stage || '')
        formData.append('duration', duration.toString())
        
        switch (customJobInputType) {
          case 'title':
            formData.append('jobTitle', customJobTitle)
            break
          case 'description':
            formData.append('jobDescription', customJobDescription)
            break
          case 'file':
            if (customJobFile) formData.append('jobFile', customJobFile)
            break
          case 'url':
            formData.append('jobUrl', customJobUrl)
            break
        }

        const response = await fetch('/api/generate-custom-questions', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const result = await response.json()
          const errorMessage = result.error || 'Failed to generate custom questions'
          const detailedMessage = result.details 
            ? `${errorMessage}\n\n${result.details}`
            : errorMessage
          throw new Error(detailedMessage)
        }

        const { questions, jobTitle: generatedJobTitle, detectedAttributes: finalDetected } = await response.json()
        
        // Navigate to custom interview with generated questions
        const params = new URLSearchParams({
          jobTitle: generatedJobTitle || 'Custom Position',
          level: level || finalDetected?.level || 'Mid Level (2-5 years)',
          companyStage: companyStage || finalDetected?.companyStage || 'Growth (Series A-C)',
          duration: duration.toString(),
          stage: stage || finalDetected?.stage || 'Technical Interview',
          customQuestions: JSON.stringify(questions)
        })

        router.push(`/interview?${params.toString()}`)
      } catch (error) {
        console.error('Error generating custom questions:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate custom questions. Please try again.'
        
        // Show error in a more user-friendly way
        if (errorMessage.includes('\n\n')) {
          // If the error has details, show them in a formatted way
          const [mainError, details] = errorMessage.split('\n\n', 2)
          alert(`${mainError}\n\nDetails: ${details}`)
        } else {
          alert(errorMessage)
        }
      } finally {
        setIsGeneratingQuestions(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-blue-600 hover:text-blue-800 mb-2"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </button>
            <h1 className="text-3xl font-bold text-gray-800 group">
              Interview Setup
            </h1>
          </div>
          <button
            onClick={() => setShowTTSTest(!showTTSTest)}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-all duration-300 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
          >
            {showTTSTest ? 'Hide' : 'Test'} TTS
          </button>
        </div>

        {showTTSTest && <TTSTestPanel />}
        
        {/* Practice Mode Toggle */}
        <div className="mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setPracticeMode('standard')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                practiceMode === 'standard' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📋 Select a Job
            </button>
            <button
              onClick={() => setPracticeMode('custom')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                practiceMode === 'custom' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎯 Share a Job
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {practiceMode === 'custom' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Practice for a Specific Job</h3>
              <p className="text-sm text-blue-700 mb-4">
                Provide job details to get tailored interview questions. We'll auto-detect experience level, company stage, and interview type from your job content.
              </p>
              
              {/* Input Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  How would you like to provide job details?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomJobInputType('title')}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      customJobInputType === 'title'
                        ? 'border-blue-500 bg-blue-100 text-blue-800'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    💼 Job Title
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomJobInputType('description')}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      customJobInputType === 'description'
                        ? 'border-blue-500 bg-blue-100 text-blue-800'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    📝 Job Description
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomJobInputType('file')}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      customJobInputType === 'file'
                        ? 'border-blue-500 bg-blue-100 text-blue-800'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    📎 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomJobInputType('url')}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      customJobInputType === 'url'
                        ? 'border-blue-500 bg-blue-100 text-blue-800'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    🔗 Job Posting URL
                  </button>
                </div>
              </div>

              {/* Input Fields */}
              {customJobInputType === 'title' && (
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Job Title & Company
                  </label>
                  <input
                    type="text"
                    value={customJobTitle}
                    onChange={(e) => setCustomJobTitle(e.target.value)}
                    placeholder="e.g., Senior Data Scientist at Google"
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {isAnalyzing && (
                    <div className="flex items-center mt-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                      Analyzing job details...
                    </div>
                  )}
                </div>
              )}

              {customJobInputType === 'description' && (
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Job Description
                  </label>
                  <textarea
                    value={customJobDescription}
                    onChange={(e) => setCustomJobDescription(e.target.value)}
                    placeholder="Paste the full job description here..."
                    rows={6}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {isAnalyzing && (
                    <div className="flex items-center mt-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                      Analyzing job description...
                    </div>
                  )}
                </div>
              )}

              {customJobInputType === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Upload Job Description File
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.txt"
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Supported formats: PDF, DOC, DOCX, TXT (max 5MB) • Analysis happens during question generation
                  </p>
                  {customJobFile && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ File selected: {customJobFile.name}
                    </p>
                  )}
                </div>
              )}

              {customJobInputType === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Job Posting URL
                  </label>
                  <input
                    type="url"
                    value={customJobUrl}
                    onChange={(e) => {
                      setCustomJobUrl(e.target.value)
                      setUrlError('')
                      // Debounced URL validation
                      const timer = setTimeout(() => {
                        if (e.target.value.trim()) {
                          validateJobUrl(e.target.value)
                        }
                      }, 1000)
                      return () => clearTimeout(timer)
                    }}
                    placeholder="https://jobs.company.com/position-123"
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      urlError ? 'border-red-300 bg-red-50' : 'border-blue-300'
                    }`}
                  />
                  {isValidatingUrl && (
                    <div className="flex items-center mt-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                      Validating URL...
                    </div>
                  )}
                  {urlError && (
                    <p className="text-sm text-red-600 mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {urlError}
                    </p>
                  )}
                  {!urlError && customJobUrl && !isValidatingUrl && (
                    <p className="text-sm text-green-600 mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      URL looks good! We'll extract job details when you start the interview.
                    </p>
                  )}
                  <p className="text-xs text-blue-600 mt-1">
                    We'll extract and analyze the job details from the URL • Supports most major job boards
                  </p>
                  <div className="mt-2 p-2 bg-blue-50 rounded-md">
                    <p className="text-xs text-blue-700 font-medium mb-1">💡 Tips for best results:</p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>• Use direct job posting URLs (not search results)</li>
                      <li>• Some sites (LinkedIn, Indeed) may require login - try company career pages instead</li>
                      <li>• Examples that work well: company career pages, AngelList, Stack Overflow Jobs</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Auto-detected values display */}
              {showDetectedValues && Object.keys(detectedAttributes).length > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">🤖 Auto-detected from job content:</h4>
                  <div className="space-y-1 text-sm text-green-700">
                    {detectedAttributes.level && (
                      <div>• Experience Level: <span className="font-medium">{detectedAttributes.level}</span></div>
                    )}
                    {detectedAttributes.companyStage && (
                      <div>• Company Stage: <span className="font-medium">{detectedAttributes.companyStage}</span></div>
                    )}
                    {detectedAttributes.stage && (
                      <div>• Interview Stage: <span className="font-medium">{detectedAttributes.stage}</span></div>
                    )}
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    You can override these values using the dropdowns below if needed.
                  </p>
                </div>
              )}
            </div>
          )}

          {practiceMode === 'standard' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <select
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a job title</option>
                {jobTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Experience Level {practiceMode === 'standard' ? '*' : '(Optional - Auto-detected)'}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required={practiceMode === 'standard'}
            >
              <option value="">{practiceMode === 'custom' ? 'Auto-detect from job content' : 'Select your level'}</option>
              {levels.map((levelOption) => (
                <option key={levelOption} value={levelOption}>
                  {levelOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Stage {practiceMode === 'standard' ? '*' : '(Optional - Auto-detected)'}
            </label>
            <select
              value={companyStage}
              onChange={(e) => setCompanyStage(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required={practiceMode === 'standard'}
            >
              <option value="">{practiceMode === 'custom' ? 'Auto-detect from job content' : 'Select company stage'}</option>
              {companyStages.map((stageOption) => (
                <option key={stageOption} value={stageOption}>
                  {stageOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Stage {practiceMode === 'standard' ? '*' : '(Optional - Defaults to Technical)'}
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required={practiceMode === 'standard'}
            >
              <option value="">{practiceMode === 'custom' ? 'Default: Technical Interview' : 'Select interview stage'}</option>
              {(practiceMode === 'standard' ? availableStages : [
                'Recruiter Screen',
                'Hiring Manager Screen',
                'Technical Interview',
                'Case Study',
                'On-site / Final Round',
                'Executive Interview'
              ]).map((stageOption) => (
                <option key={stageOption} value={stageOption}>
                  {stageOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isGeneratingQuestions}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isGeneratingQuestions ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Custom Questions...
              </>
            ) : (
              practiceMode === 'custom' ? 'Generate Custom Interview' : 'Start Interview'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>🎯 AI-powered interview practice with real-time feedback</p>
        </div>
      </div>
    </div>
  )
} 
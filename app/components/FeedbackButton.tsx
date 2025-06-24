'use client'

import { useState } from 'react'

interface FeedbackButtonProps {
  email: string
}

export default function FeedbackButton({ email }: FeedbackButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback,
          userEmail,
          page: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        setFeedback('')
        setUserEmail('')
        setTimeout(() => {
          setShowModal(false)
          setSubmitted(false)
        }, 2000)
      } else {
        alert('Failed to submit feedback. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating Feedback Button */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center"
          aria-label="Send Feedback"
        >
          💬
        </button>
        <div className="text-xs text-gray-600 text-right">
          <a
            href={`mailto:${email}?subject=Career Journey AI Feedback`}
            className="hover:text-blue-600 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            or email us
          </a>
        </div>
      </div>

      {/* Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Send Feedback</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {submitted ? (
                <div className="text-center py-8">
                  <div className="text-green-600 text-4xl mb-4">✅</div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Thank you!</h4>
                  <p className="text-gray-600">Your feedback has been submitted successfully.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                      What's your feedback? *
                    </label>
                    <textarea
                      id="feedback"
                      required
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder="Tell us what you think, report a bug, or suggest an improvement..."
                    />
                  </div>

                  <div>
                    <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-2">
                      Your email (optional)
                    </label>
                    <input
                      type="email"
                      id="userEmail"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="your@email.com (if you'd like a reply)"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <div className="text-xs text-gray-500">
                      Prefer email?{' '}
                      <a
                        href={`mailto:${email}?subject=Career Journey AI Feedback`}
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Send us an email
                      </a>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || !feedback.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Sending...' : 'Send Feedback'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
} 
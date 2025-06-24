import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import FeedbackButton from './components/FeedbackButton'

export const metadata: Metadata = {
  title: 'Career Journey AI',
  description: 'AI-powered interview practice and salary negotiation coaching',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2">
                  <span className="text-xl font-bold text-gray-900">Career Journey AI</span>
                </Link>
              </div>
              <div className="flex items-center space-x-8">
                <Link
                  href="/interview-setup"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Interview Practice
                </Link>
                <Link
                  href="/negotiation"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Negotiation Coach
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <div className="container mx-auto">
          {children}
        </div>
        
        {/* Floating Feedback Button - appears on all pages */}
        <FeedbackButton email="careerjourneyai@gmail.com" />
      </body>
    </html>
  )
} 
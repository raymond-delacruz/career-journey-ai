import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Try to check if feedbacks table exists
    console.log('🔍 Checking database tables...')
    
    const { data: tablesData, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tablesError) {
      console.error('Error checking tables:', tablesError)
    }

    // Try the feedbacks table specifically
    const { data: feedbackData, error: feedbackError } = await supabaseAdmin
      .from('feedbacks')
      .select('*')
      .limit(1)

    return NextResponse.json({
      tables_check: {
        success: !tablesError,
        error: tablesError,
        tables: tablesData
      },
      feedbacks_table: {
        exists: !feedbackError,
        error: feedbackError,
        sample_data: feedbackData
      }
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to check database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
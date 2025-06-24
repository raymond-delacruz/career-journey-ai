export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing Supabase connection...')
    
    // Test 1: Check if we can connect to Supabase
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError)
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: tablesError 
      })
    }

    console.log('✅ Available tables:', tables)

    // Test 2: Check feedbacks table structure
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'feedbacks')
      .eq('table_schema', 'public')

    if (columnsError) {
      console.error('❌ Error fetching columns:', columnsError)
    }

    console.log('🏗️ Feedbacks table columns:', columns)

    // Test 3: Try a simple insert
    const testData = {
      feedbackText: 'Test feedback from API test',
      userEmail: 'test@example.com',
      page: '/test',
      userAgent: 'Test Agent',
      timestamp: new Date().toISOString()
    }

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('feedbacks')
      .insert([testData])
      .select()

    if (insertError) {
      console.error('❌ Insert error:', insertError)
      return NextResponse.json({ 
        tables,
        columns,
        insertError: insertError,
        testData
      })
    }

    console.log('✅ Insert successful:', insertData)

    return NextResponse.json({ 
      success: true,
      tables,
      columns,
      insertData,
      message: 'Database test completed successfully'
    })

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Unexpected error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 
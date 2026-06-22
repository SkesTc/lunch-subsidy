import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'

export async function GET() {
  const settings = await getAllSettings()
  return NextResponse.json(settings)
}

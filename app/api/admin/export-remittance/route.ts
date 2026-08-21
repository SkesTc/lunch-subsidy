import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester') || '1') as 1 | 2
  const planId = searchParams.get('plan_id') || null
  const bankFilter = searchParams.get('bank') || null  // 'taiwan' | 'other' | null (全部)
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()

  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  const schoolBaseQuery = supabaseAdmin.from('schools').select('id, code, district, name').eq('is_active', true).order('code')
  const schoolFinalQuery = allowedIds !== null ? schoolBaseQuery.in('id', allowedIds.length ? allowedIds : [-1]) : schoolBaseQuery

  const [
    { data: schools },
    { data: amounts },
    { data: banks },
    { data: sem1Settles },
    { data: planAmtRows },
  ] = await Promise.all([
    schoolFinalQuery,
    supabaseAdmin.from('school_amounts').select('school_id, sem1_amount, sem2_amount').eq('school_year', schoolYear),
    supabaseAdmin.from('bank_accounts').select('school_id, bank_name, branch_name, bank_code, account_name, account_number').eq('semester', 1),
    planId
      ? supabaseAdmin.from('settlements').select('school_id, total_expense, plan_id').eq('school_year', schoolYear).eq('plan_id', planId).eq('semester', 1)
      : supabaseAdmin.from('settlements').select('school_id, repay_amount').eq('school_year', schoolYear).eq('semester', 1).is('plan_id', null),
    planId
      ? supabaseAdmin.from('plan_amounts').select('school_id, semester, amount').eq('plan_id', planId).eq('school_year', schoolYear)
      : { data: null },
  ])

  const amountMap = new Map((amounts || []).map(a => [a.school_id, a]))
  const bankMap = new Map((banks || []).map(b => [b.school_id, b]))
  const planAmtMap: Record<number, Record<number, number>> = {}
  for (const pa of (planAmtRows || [])) {
    if (!planAmtMap[pa.school_id]) planAmtMap[pa.school_id] = {}
    planAmtMap[pa.school_id][(pa as { semester: number }).semester] = (pa as { amount: number }).amount
  }
  const sem1RepayMap = new Map((sem1Settles || []).map(s => {
    if (planId) {
      const ss = s as { school_id: number; total_expense: number }
      const approved = planAmtMap[ss.school_id]?.[1] || 0
      const repay = approved > 0 && ss.total_expense > 0 ? Math.max(0, Math.ceil(approved - ss.total_expense)) : 0
      return [ss.school_id, repay]
    }
    const ss = s as { school_id: number; repay_amount: number }
    return [ss.school_id, ss.repay_amount || 0]
  }))

  const rows = (schools || []).filter(s => {
    const bank = bankMap.get(s.id)
    const isTaiwan = (bank?.bank_name || '').includes('臺灣銀行') || (bank?.bank_name || '').includes('台灣銀行')
    if (bankFilter === 'taiwan') return isTaiwan
    if (bankFilter === 'other') return !isTaiwan
    return true
  }).map(s => {
    const amt = amountMap.get(s.id)
    const bank = bankMap.get(s.id)
    const sem1Repay = sem1RepayMap.get(s.id) || 0
    const approved = planId
      ? (planAmtMap[s.id]?.[semester] || 0)
      : (semester === 1 ? (amt?.sem1_amount || 0) : (amt?.sem2_amount || 0))

    const remittance = semester === 1
      ? approved
      : Math.max(0, approved - sem1Repay)

    return {
      '編號': s.code,
      '區別': s.district,
      '學校名稱': s.name,
      '銀行名稱': bank?.bank_name || '',
      '帳戶名稱': bank?.account_name || '',
      '局號': bank?.bank_code || '',
      '帳號': bank?.account_number || '',
      [`第${semester}學期匯款金額`]: remittance,
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [6, 8, 20, 14, 10, 20, 14].map(w => ({ wch: w }))
  const bankLabelCN = bankFilter === 'taiwan' ? '（臺灣銀行）' : bankFilter === 'other' ? '（非臺灣銀行）' : ''
  const bankLabelASCII = bankFilter === 'taiwan' ? '_taiwan' : bankFilter === 'other' ? '_other' : ''
  XLSX.utils.book_append_sheet(wb, ws, `第${semester}學期匯款清冊${bankLabelCN}`)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `${schoolYear}_sem${semester}_remittance${bankLabelASCII}.xlsx`

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

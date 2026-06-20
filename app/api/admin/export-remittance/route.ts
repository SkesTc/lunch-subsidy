import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester') || '1') as 1 | 2
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()

  const [
    { data: schools },
    { data: amounts },
    { data: banks },
    { data: sem1Settles },
  ] = await Promise.all([
    supabaseAdmin.from('schools').select('id, code, district, name').eq('is_active', true).order('code'),
    supabaseAdmin.from('school_amounts').select('school_id, sem1_amount, sem2_amount').eq('school_year', schoolYear),
    supabaseAdmin.from('bank_accounts').select('school_id, bank_name, branch_name, bank_code, account_name, account_number').eq('semester', 1),
    supabaseAdmin.from('settlements').select('school_id, repay_amount').eq('school_year', schoolYear).eq('semester', 1),
  ])

  const amountMap = new Map((amounts || []).map(a => [a.school_id, a]))
  const bankMap = new Map((banks || []).map(b => [b.school_id, b]))
  const sem1RepayMap = new Map((sem1Settles || []).map(s => [s.school_id, s.repay_amount || 0]))

  const rows = (schools || []).map(s => {
    const amt = amountMap.get(s.id)
    const bank = bankMap.get(s.id)
    const sem1Repay = sem1RepayMap.get(s.id) || 0

    const remittance = semester === 1
      ? (amt?.sem1_amount || 0)
      : Math.max(0, (amt?.sem2_amount || 0) - sem1Repay)

    return {
      '編號': s.code,
      '區別': s.district,
      '學校名稱': s.name,
      '銀行名稱': bank?.bank_name || '',
      '分行名稱': bank?.branch_name || '',
      '金融機構代碼': bank?.bank_code || '',
      '帳戶戶名': bank?.account_name || '',
      '帳號': bank?.account_number || '',
      [`第${semester}學期匯款金額`]: remittance,
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [6, 8, 20, 12, 12, 10, 14, 16, 14].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, `第${semester}學期匯款清冊`)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${schoolYear}_sem${semester}_remittance.xlsx"`,
    },
  })
}

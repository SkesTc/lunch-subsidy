import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { formatAmount } from '@/lib/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))
  const type = searchParams.get('type')
  const schoolYear = await getActiveSchoolYear()

  const { data: schools } = await supabaseAdmin.from('schools').select('id, code, district, name').eq('is_active', true).order('code')
  const { data: amounts } = await supabaseAdmin.from('school_amounts').select('*').eq('school_year', schoolYear)
  const { data: banks } = await supabaseAdmin.from('bank_accounts').select('*').eq('semester', semester).eq('school_year', schoolYear)
  const { data: settlements } = await supabaseAdmin.from('settlements').select('*').eq('semester', semester).eq('school_year', schoolYear)

  if (type === 'bank') {
    const rows = (schools || []).map(s => {
      const b = banks?.find(b => b.school_id === s.id)
      const a = amounts?.find(a => a.school_id === s.id)
      return {
        '編號': s.code,
        '區別': s.district,
        '學校名稱': s.name,
        '核定金額': semester === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0),
        '銀行名稱': b?.bank_name || '',
        '分行名稱': b?.branch_name || '',
        '金融機構代碼': b?.bank_code || '',
        '帳戶戶名': b?.account_name || '',
        '帳號': b?.account_number || '',
        '聯絡人': b?.contact_name || '',
        '聯絡電話': b?.contact_phone || '',
        '確認時間': b?.confirmed_at ? new Date(b.confirmed_at).toLocaleString('zh-TW') : '',
        '是否修改': b?.is_modified ? '是' : '否',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '帳戶彙整')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${schoolYear}_semester${semester}_bank.xlsx"`,
      }
    })
  }

  if (type === 'settlement') {
    const rows = (schools || []).map(s => {
      const st = settlements?.find(x => x.school_id === s.id)
      const a = amounts?.find(a => a.school_id === s.id)
      const A = semester === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0)
      const B = A
      const C = A > 0 ? B / A : 1
      const D = st?.total_expense || st?.business_expense || 0
      const E = A - D
      const F = E > 0 ? Math.ceil(E * C) : 0
      return {
        '編號': s.code,
        '區別': s.district,
        '學校名稱': s.name,
        'A. 核定計畫金額': A,
        'B. 核定補助金額': B,
        'C. 補助比率 (B/A)': A > 0 ? `${(C * 100).toFixed(2)}%` : '—',
        'D. 實支總額': D,
        'E. 計畫結餘款 (A-D)': E,
        'F. 應繳回本局 (E×C)': F > 0 ? F : 0,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [6, 8, 20, 14, 14, 14, 14, 16, 16].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `第${semester}學期收支結算表`)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${schoolYear}_semester${semester}_settlement.xlsx"`,
      }
    })
  }

  // surplus
  const rows = (schools || []).map(s => {
    const st = settlements?.find(x => x.school_id === s.id)
    const a = amounts?.find(a => a.school_id === s.id)
    return {
      '編號': s.code,
      '區別': s.district,
      '學校名稱': s.name,
      '核定金額': semester === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0),
      '實支總額': st?.total_expense || 0,
      '計畫結餘款': st?.surplus || 0,
      '應繳回金額': st?.repay_amount || 0,
      '送款憑單': st?.remittance_file_path ? '已上傳' : (st?.repay_amount > 0 ? '未上傳' : '-'),
      '繳款日期': st?.remittance_date || '',
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '賸餘款彙整')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${schoolYear}_semester${semester}_surplus.xlsx"`,
    }
  })
}

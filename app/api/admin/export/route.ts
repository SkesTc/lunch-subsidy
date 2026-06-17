import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { formatAmount } from '@/lib/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))
  const type = searchParams.get('type')

  const { data: schools } = await supabaseAdmin.from('schools').select('*').order('code')
  const { data: banks } = await supabaseAdmin.from('bank_accounts').select('*').eq('semester', semester)
  const { data: settlements } = await supabaseAdmin.from('settlements').select('*').eq('semester', semester)

  if (type === 'bank') {
    const rows = (schools || []).map(s => {
      const b = banks?.find(b => b.school_id === s.id)
      return {
        '編號': s.code,
        '區別': s.district,
        '學校名稱': s.name,
        '核定金額': semester === 1 ? s.sem1_amount : s.sem2_amount,
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
        'Content-Disposition': `attachment; filename="semester${semester}_bank.xlsx"`,
      }
    })
  }

  // surplus
  const rows = (schools || []).map(s => {
    const st = settlements?.find(x => x.school_id === s.id)
    return {
      '編號': s.code,
      '區別': s.district,
      '學校名稱': s.name,
      '核定金額': semester === 1 ? s.sem1_amount : s.sem2_amount,
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
      'Content-Disposition': `attachment; filename="semester${semester}_surplus.xlsx"`,
    }
  })
}

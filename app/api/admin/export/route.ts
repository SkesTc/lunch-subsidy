import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
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

  const planId = searchParams.get('plan_id') || null

  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  let schoolQuery = supabaseAdmin.from('schools').select('id, code, district, name').eq('is_active', true).order('code')
  if (allowedIds !== null) schoolQuery = schoolQuery.in('id', allowedIds.length ? allowedIds : [-1])
  const { data: schools } = await schoolQuery
  const { data: amounts } = await supabaseAdmin.from('school_amounts').select('school_id, sem1_amount, sem2_amount, approved_total').eq('school_year', schoolYear)
  const { data: banks } = await supabaseAdmin.from('bank_accounts').select('school_id, bank_name, branch_name, bank_code, account_name, account_number, contact_name, contact_phone, confirmed_at, is_modified').eq('semester', semester).eq('school_year', schoolYear)
  const settleQuery = planId
    ? supabaseAdmin.from('settlements').select('school_id, plan_id, total_expense, business_expense, surplus, repay_amount, scan_file_path, remittance_file_path, remittance_date, status').eq('plan_id', planId).eq('semester', semester).eq('school_year', schoolYear)
    : supabaseAdmin.from('settlements').select('school_id, plan_id, total_expense, business_expense, surplus, repay_amount, scan_file_path, remittance_file_path, remittance_date, status').eq('semester', semester).eq('school_year', schoolYear).is('plan_id', null)
  const { data: settlements } = await settleQuery
  // 計畫模式：取該計畫學期的核定金額
  const { data: planAmtRows } = planId
    ? await supabaseAdmin.from('plan_amounts').select('school_id, amount').eq('plan_id', planId).eq('semester', semester).eq('school_year', schoolYear)
    : { data: null }
  const planAmtMap: Record<number, number> = Object.fromEntries((planAmtRows || []).map(r => [r.school_id, r.amount]))

  if (type === 'bank') {
    const rows = (schools || []).map(s => {
      const b = banks?.find(b => b.school_id === s.id)
      const a = amounts?.find(a => a.school_id === s.id)
      return {
        '編號': s.code,
        '區別': s.district,
        '學校名稱': s.name,
        '核定金額': planId ? (planAmtMap[s.id] || 0) : (semester === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0)),
        '銀行名稱': b?.bank_name || '',
        '帳戶名稱': b?.account_name || '',
        '局號': b?.bank_code || '',
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
      const A = planId
        ? (planAmtMap[s.id] || 0)
        : (semester === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0))
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

  // surplus（動態計算，不依賴 DB 存的舊值）
  const rows = (schools || []).map(s => {
    const st = settlements?.find(x => x.school_id === s.id)
    const a = amounts?.find(a => a.school_id === s.id)
    const approved = planId
      ? (planAmtMap[s.id] || 0)
      : (semester === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0))
    const expense = st?.total_expense || 0
    const surplus = approved > 0 && expense > 0 ? approved - expense : 0
    const repay = surplus > 0 ? Math.ceil(surplus) : 0
    return {
      '編號': s.code,
      '區別': s.district,
      '學校名稱': s.name,
      '核定金額': approved,
      '實支總額': expense,
      '計畫結餘款': surplus,
      '應繳回金額': repay,
      '送款憑單': st?.remittance_file_path ? '已上傳' : (repay > 0 ? '未上傳' : '-'),
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

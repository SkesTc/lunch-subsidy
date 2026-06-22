import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings, invalidateSettingsCache } from '@/lib/settings'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const BUCKET = 'settlement-files'
const SETTINGS_PATH = '__system/settings.json'

async function writeSettings(s: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
  await supabaseAdmin.storage.from(BUCKET).upload(SETTINGS_PATH, blob, { upsert: true, contentType: 'application/json' })
  invalidateSettingsCache()
}

// GET: list all school years + active year
export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const settings = await getAllSettings()
  const active = settings.active_school_year || settings.school_year || '115'
  const years: string[] = Array.isArray(settings.school_years) && settings.school_years.length
    ? settings.school_years : ['115']

  // Also gather counts per year from DB
  const { data: settlementYears } = await supabaseAdmin
    .from('settlements').select('school_year').neq('school_year', null)
  const { data: bankYears } = await supabaseAdmin
    .from('bank_accounts').select('school_year').neq('school_year', null)

  const dbYears = new Set([
    ...(settlementYears || []).map((r: { school_year: string }) => r.school_year),
    ...(bankYears || []).map((r: { school_year: string }) => r.school_year),
  ])
  const allYears = Array.from(new Set([...years, ...dbYears])).sort().reverse()

  return NextResponse.json({ active, years: allYears })
}

// POST action: switch | add | backup
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { action, schoolYear } = await req.json()
  const settings = await getAllSettings()

  if (action === 'switch') {
    const years: string[] = Array.isArray(settings.school_years) ? settings.school_years : ['115']
    if (!years.includes(schoolYear)) return NextResponse.json({ error: '學年度不存在' }, { status: 400 })
    await writeSettings({ ...settings, active_school_year: schoolYear, school_year: schoolYear })
    return NextResponse.json({ ok: true })
  }

  if (action === 'add') {
    if (!schoolYear || !/^\d{3}$/.test(schoolYear))
      return NextResponse.json({ error: '學年度格式錯誤（請輸入三位數字，例如 116）' }, { status: 400 })
    const years: string[] = Array.isArray(settings.school_years) ? settings.school_years : ['115']
    if (years.includes(schoolYear)) return NextResponse.json({ error: '此學年度已存在' }, { status: 409 })
    const newYears = [...years, schoolYear].sort()
    await writeSettings({ ...settings, school_years: newYears, active_school_year: schoolYear, school_year: schoolYear })
    return NextResponse.json({ ok: true })
  }

  if (action === 'backup') {
    if (!schoolYear) return NextResponse.json({ error: '未指定學年度' }, { status: 400 })

    const [
      { data: schools },
      { data: amounts },
      { data: banks },
      { data: settlements },
      { data: accounts },
    ] = await Promise.all([
      supabaseAdmin.from('schools').select('id, code, district, name, is_active').order('code'),
      supabaseAdmin.from('school_amounts').select('school_id, school_year, sem1_amount, sem2_amount, approved_total').eq('school_year', schoolYear),
      supabaseAdmin.from('bank_accounts').select('school_id, semester, school_year, bank_name, branch_name, bank_code, account_name, account_number, confirmed_at, is_modified').eq('school_year', schoolYear),
      supabaseAdmin.from('settlements').select('school_id, semester, school_year, status, personnel_expense, business_expense, equipment_expense, total_expense, surplus, repay_amount, scan_file_path, remittance_file_path, remittance_date').eq('school_year', schoolYear),
      supabaseAdmin.from('profiles').select('email, is_admin, school_id, created_at').order('created_at'),
    ])

    const schoolMap = Object.fromEntries((schools || []).map(s => [s.id, s]))

    // 學校清單
    const schoolRows = (schools || []).map(s => {
      const a = amounts?.find(x => x.school_id === s.id)
      return {
        '編號': s.code,
        '區別': s.district,
        '學校名稱': s.name,
        '狀態': s.is_active ? '啟用' : '停用',
        [`${schoolYear}學年第1學期核定`]: a?.sem1_amount || 0,
        [`${schoolYear}學年第2學期核定`]: a?.sem2_amount || 0,
      }
    })

    // 帳戶資料
    const bankRows = (banks || []).map(b => ({
      '學年度': b.school_year,
      '學期': b.semester,
      '編號': schoolMap[b.school_id]?.code || '',
      '學校名稱': schoolMap[b.school_id]?.name || '',
      '銀行名稱': b.bank_name,
      '分行名稱': b.branch_name,
      '金融機構代碼': b.bank_code,
      '帳戶戶名': b.account_name,
      '帳號': b.account_number,
      '確認時間': b.confirmed_at ? new Date(b.confirmed_at).toLocaleString('zh-TW') : '',
      '是否修改': b.is_modified ? '是' : '否',
    }))

    // 核銷資料
    const settleRows = (settlements || []).map(s => ({
      '學年度': s.school_year,
      '學期': s.semester,
      '編號': schoolMap[s.school_id]?.code || '',
      '學校名稱': schoolMap[s.school_id]?.name || '',
      '人事費': s.personnel_expense,
      '業務費': s.business_expense,
      '設備費': s.equipment_expense,
      '實支總額': s.total_expense,
      '計畫結餘款': s.surplus,
      '應繳回金額': s.repay_amount,
      '狀態': s.status,
      '掃描檔': s.scan_file_path || '',
      '送款憑單': s.remittance_file_path || '',
      '繳款日期': s.remittance_date || '',
    }))

    // 帳號清單
    const accountRows = (accounts || []).map(a => ({
      'Email': a.email,
      '身份': a.is_admin ? '管理員' : '學校',
      '綁定學校': a.school_id ? (schoolMap[a.school_id]?.name || `ID:${a.school_id}`) : '',
      '建立時間': new Date(a.created_at).toLocaleString('zh-TW'),
    }))

    // 系統設定
    const settingRows = Object.entries(settings).map(([k, v]) => ({ '設定項目': k, '設定值': String(v) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schoolRows), '學校清單')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bankRows), '帳戶資料')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settleRows), '核銷資料')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accountRows), '帳號清單')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingRows), '系統設定')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${schoolYear}_backup.xlsx"`,
      },
    })
  }

  if (action === 'clear-reviews') {
    if (!schoolYear) return NextResponse.json({ error: '未指定學年度' }, { status: 400 })

    // 1. 清除 change_requests 表（實支金額修改、掃描檔/憑單上傳申請）
    const { error: crError, count: crCount } = await supabaseAdmin
      .from('change_requests')
      .delete({ count: 'exact' })
      .eq('school_year', schoolYear)
    if (crError) return NextResponse.json({ error: crError.message }, { status: 500 })

    // 2. 清除 Storage 中的帳戶變更申請 JSON 檔（格式：{schoolId}_{schoolYear}.json）
    const { data: acFiles } = await supabaseAdmin.storage.from(BUCKET).list('__account-changes')
    const toDelete = (acFiles || [])
      .filter(f => f.name.endsWith(`_${schoolYear}.json`))
      .map(f => `__account-changes/${f.name}`)
    let acCount = 0
    if (toDelete.length > 0) {
      await supabaseAdmin.storage.from(BUCKET).remove(toDelete)
      acCount = toDelete.length
    }

    return NextResponse.json({ ok: true, deleted: (crCount ?? 0) + acCount })
  }

  return NextResponse.json({ error: '未知的 action' }, { status: 400 })
}

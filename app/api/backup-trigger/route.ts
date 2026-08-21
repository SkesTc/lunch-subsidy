import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { getGasSettings } from '@/lib/gas'

// 此端點專供 GAS 定時觸發呼叫，不需管理員 session
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))

  // 驗證 GAS 驗證金鑰
  const { gasSecret } = await getGasSettings()
  if (!gasSecret || body.secret !== gasSecret) {
    return NextResponse.json({ error: '驗證失敗' }, { status: 403 })
  }

  const settings = await getAllSettings()
  const { gasUrl } = await getGasSettings()
  const backupFolderId = settings.backup_folder_id as string

  if (!backupFolderId) return NextResponse.json({ error: '備份資料夾 ID 未設定' }, { status: 400 })

  try {
    // 查詢所有資料
    const [
      { data: schools }, { data: plans }, { data: planAmounts },
      { data: schoolAmounts }, { data: settlements }, { data: bankAccounts },
      { data: changeRequests }, { data: userProfiles },
    ] = await Promise.all([
      supabaseAdmin.from('schools').select('*').order('code'),
      supabaseAdmin.from('plans').select('*').order('sort_order'),
      supabaseAdmin.from('plan_amounts').select('*'),
      supabaseAdmin.from('school_amounts').select('*'),
      supabaseAdmin.from('settlements').select('*'),
      supabaseAdmin.from('bank_accounts').select('*'),
      supabaseAdmin.from('change_requests').select('*').order('created_at'),
      supabaseAdmin.from('user_profiles').select('*'),
    ])

    const payload = {
      version: '1.1', type: 'scheduled',
      created_at: new Date().toISOString(),
      system_name: settings.system_name || '',
      data: { schools, plans, plan_amounts: planAmounts, school_amounts: schoolAmounts, settlements, bank_accounts: bankAccounts, change_requests: changeRequests, user_profiles: userProfiles },
      settings,
    }

    const json = JSON.stringify(payload, null, 2)
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
    const filename = `backup_scheduled_${ts}.json`

    // 上傳至 Drive
    const uploadRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup_upload', secret: gasSecret, folderId: backupFolderId, filename, content: json }),
    })
    const uploadData = await uploadRes.json()
    if (!uploadData.ok) throw new Error(uploadData.error || '上傳失敗')

    // 清理舊備份
    const retainDays = Number(settings.backup_retain_daily) || 30
    const retainManual = Number(settings.backup_retain_manual) || 10
    fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup_cleanup', secret: gasSecret, folderId: backupFolderId, retainDays, retainManual }),
    }).catch(() => {})

    // 寄通知信
    if (settings.backup_notify_email) {
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify', secret: gasSecret,
          to: String(settings.backup_notify_email),
          subject: '【核銷系統】定時備份完成通知',
          body: `備份時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n檔案：${filename}\n（${(json.length / 1024).toFixed(0)} KB）`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, filename })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '備份失敗' }, { status: 500 })
  }
}

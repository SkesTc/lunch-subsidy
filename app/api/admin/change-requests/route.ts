import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear, getAllSettings, getSettingsForZone, getGlobalSystemName } from '@/lib/settings'
import { getGasSettings, gasDeleteFile } from '@/lib/gas'
import { calcRatio, calcSurplus, calcRepay } from '@/lib/utils'
import { wrapEmailHtml } from '@/lib/email-html'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

async function getContact(email: string): Promise<{ contact_name?: string; contact_title?: string; contact_phone?: string }> {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('contact_name, contact_title, contact_phone')
    .eq('email', email)
    .single()
  return data || {}
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const [schoolYear, zoneUser] = await Promise.all([
    getActiveSchoolYear(),
    getUserZoneRole(session.user.email!),
  ])
  const zoneSchoolIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  let reqQuery = supabaseAdmin
    .from('change_requests')
    .select('*, schools(name, code, district)')
    .eq('school_year', schoolYear)
    .order('created_at', { ascending: false })
  if (zoneSchoolIds !== null) {
    reqQuery = reqQuery.in('school_id', zoneSchoolIds.length ? zoneSchoolIds : [-1])
  }
  const { data: requests } = await reqQuery

  if (!requests) return NextResponse.json([])

  // 所有申請都需要補充財務資料（核定金額、實支、結餘）
  const schoolIds = [...new Set(requests.map(r => r.school_id))]

  // 收集 plan_ids（for plan-based requests）
  const planIds = [...new Set(requests.map(r => r.plan_id).filter(Boolean))] as string[]

  const [{ data: settles }, { data: amounts }, { data: planSettles }, { data: planAmountRows }, { data: plansData }] = await Promise.all([
    supabaseAdmin
      .from('settlements')
      .select('school_id, semester, plan_id, scan_file_path, remittance_file_path, business_expense, total_expense, surplus, repay_amount')
      .eq('school_year', schoolYear)
      .in('school_id', schoolIds),
    supabaseAdmin.from('school_amounts').select('school_id, sem1_amount, sem2_amount').eq('school_year', schoolYear).in('school_id', schoolIds),
    planIds.length > 0
      ? supabaseAdmin.from('settlements').select('school_id, plan_id, semester, scan_file_path, remittance_file_path, business_expense, total_expense, surplus, repay_amount').eq('school_year', schoolYear).in('plan_id', planIds)
      : Promise.resolve({ data: [] }),
    planIds.length > 0
      ? supabaseAdmin.from('plan_amounts').select('school_id, plan_id, semester, amount').eq('school_year', schoolYear).in('plan_id', planIds)
      : Promise.resolve({ data: [] }),
    planIds.length > 0
      ? supabaseAdmin.from('plans').select('id, label').in('id', planIds)
      : Promise.resolve({ data: [] }),
  ])

  type SettleInfo = { scan_file_path: string | null; remittance_file_path: string | null; business_expense: number | null; total_expense: number | null; surplus: number | null; repay_amount: number | null }
  const settleMap: Record<string, SettleInfo> = {}
  const planSettleMap: Record<string, SettleInfo> = {}
  const approvedAmountMap: Record<string, { sem1_amount: number; sem2_amount: number }> = {}
  const planAmountMap: Record<string, number> = {}
  const planLabelMap: Record<string, string> = {}

  for (const s of settles ?? []) {
    settleMap[`${s.school_id}_${s.semester}`] = s
  }
  for (const s of planSettles ?? []) {
    if (s.plan_id) planSettleMap[`${s.school_id}_${s.plan_id}_${s.semester ?? ''}`] = s
  }
  for (const a of amounts ?? []) {
    approvedAmountMap[String(a.school_id)] = { sem1_amount: a.sem1_amount, sem2_amount: a.sem2_amount }
  }
  for (const pa of planAmountRows ?? []) {
    planAmountMap[`${pa.school_id}_${pa.plan_id}_${(pa as { semester: number }).semester}`] = pa.amount
  }
  for (const p of plansData ?? []) {
    planLabelMap[p.id] = p.label
  }

  const enriched = requests.map(r => {
    const settle = r.plan_id
      ? planSettleMap[`${r.school_id}_${r.plan_id}_${r.semester ?? ''}`]
      : settleMap[`${r.school_id}_${r.semester}`]
    const amtRow = approvedAmountMap[String(r.school_id)]
    const approved_amount = r.plan_id
      ? (planAmountMap[`${r.school_id}_${r.plan_id}_${r.semester}`] ?? null)
      : (r.semester === 1 ? (amtRow?.sem1_amount ?? null) : (amtRow?.sem2_amount ?? null))
    const plan_label = r.plan_id ? (planLabelMap[r.plan_id] ?? null) : null
    const actual_expense = settle?.total_expense ?? settle?.business_expense ?? null
    // 動態計算結餘，不依賴 DB 存的舊值
    const surplus = (approved_amount != null && actual_expense != null && approved_amount > 0)
      ? approved_amount - actual_expense
      : (settle?.surplus ?? null)
    const financial = {
      approved_amount,
      actual_expense,
      surplus,
      plan_label,
    }

    if (r.request_type === 'scan_reupload' || r.request_type === 'remittance_reupload') {
      const existing_file_path = r.request_type === 'scan_reupload'
        ? (settle?.scan_file_path ?? null)
        : (settle?.remittance_file_path ?? null)
      return { ...r, existing_file_path, existing_amount: null, ...financial }
    }
    if (r.request_type === 'scan_upload' || r.request_type === 'remittance_upload') {
      return { ...r, existing_file_path: null, existing_amount: null, ...financial }
    }
    if (r.request_type === 'amount_modify') {
      return { ...r, existing_file_path: null, existing_amount: settle?.business_expense ?? null, ...financial }
    }
    return { ...r, existing_file_path: null, existing_amount: null, ...financial }
  })

  return NextResponse.json(enriched)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { id, action, admin_note } = await req.json()
  if (!id || !action) return NextResponse.json({ error: '資料不完整' }, { status: 400 })

  // 【優化1】並行：取得申請記錄 + 學年度 + 全域設定（GAS 設定用）
  const [{ data: cr }, schoolYear, globalSettings] = await Promise.all([
    supabaseAdmin.from('change_requests').select('*, schools(name)').eq('id', id).single(),
    getActiveSchoolYear(),
    getAllSettings(),
  ])
  if (!cr) return NextResponse.json({ error: '找不到申請' }, { status: 404 })
  if (cr.status !== 'pending') return NextResponse.json({ error: '已審核' }, { status: 409 })

  // 取學校所屬分區的設定（承辦學校、承辦人等用分區設定）
  const { data: zoneRow } = await supabaseAdmin
    .from('zones').select('id, name').contains('zone_ids', [cr.school_id]).single()
  const allSettings = zoneRow
    ? await getSettingsForZone(zoneRow.id)
    : globalSettings
  const zoneShortName = zoneRow?.name || String(allSettings.system_name || '')

  const gasUrl = globalSettings.gas_url || ''
  const gasSecret = globalSettings.gas_secret || ''
  const now = new Date().toISOString()
  const schoolName = (cr.schools as unknown as { name: string } | null)?.name || ''

  const updateCR = supabaseAdmin.from('change_requests').update({
    status: action,
    admin_note: admin_note?.trim() || null,
    reviewed_at: now,
    reviewed_by: session.user.email,
  }).eq('id', id)

  if (action === 'approved') {
    if (cr.request_type === 'amount_modify') {
      // 【優化2】並行：更新 change_requests + 查 school_amounts + 查 user_profiles
      const [, { data: amountRow }, { data: profile }] = await Promise.all([
        updateCR,
        supabaseAdmin.from('school_amounts').select('sem1_amount, sem2_amount')
          .eq('school_id', cr.school_id).eq('school_year', schoolYear).single(),
        supabaseAdmin.from('user_profiles')
          .select('email, contact_name, contact_title, contact_phone')
          .eq('school_id', cr.school_id).eq('is_admin', false).single(),
      ])

      let A = 0
      if (cr.plan_id) {
        const { data: pa } = await supabaseAdmin.from('plan_amounts').select('amount')
          .eq('school_id', cr.school_id).eq('plan_id', cr.plan_id)
          .eq('school_year', schoolYear).eq('semester', cr.semester).maybeSingle()
        A = pa?.amount || 0
      } else {
        A = cr.semester === 1 ? (amountRow?.sem1_amount || 0) : (amountRow?.sem2_amount || 0)
      }
      const D = cr.new_amount
      const E = calcSurplus(A, D)
      const F = calcRepay(E, calcRatio(A, A))

      const updateSettleQ = cr.plan_id
        ? supabaseAdmin.from('settlements').update({
            business_expense: D, total_expense: D, surplus: E, repay_amount: F,
            amount_locked: true, updated_at: now,
          }).eq('school_id', cr.school_id).eq('plan_id', cr.plan_id)
            .eq('semester', cr.semester).eq('school_year', schoolYear)
        : supabaseAdmin.from('settlements').update({
            business_expense: D, total_expense: D, surplus: E, repay_amount: F,
            amount_locked: true, updated_at: now,
          }).eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear).is('plan_id', null)
      await updateSettleQ

      // 寄信
      await sendReviewEmail({ profile, allSettings, gasUrl, gasSecret, cr, schoolName, admin_note, isApproved: true })

    } else if (
      cr.request_type === 'scan_reupload' || cr.request_type === 'remittance_reupload' ||
      cr.request_type === 'scan_upload' || cr.request_type === 'remittance_upload'
    ) {
      const isScan = cr.request_type === 'scan_reupload' || cr.request_type === 'scan_upload'
      const fileField = isScan ? 'scan_file_path' : 'remittance_file_path'
      const isReupload = cr.request_type === 'scan_reupload' || cr.request_type === 'remittance_reupload'

      // 【優化3】並行：更新 change_requests + 查 settlement + 查 user_profiles
      const settleQ = cr.plan_id
        ? supabaseAdmin.from('settlements').select(`id, ${fileField}`)
            .eq('school_id', cr.school_id).eq('plan_id', cr.plan_id)
            .eq('semester', cr.semester).eq('school_year', schoolYear).maybeSingle()
        : supabaseAdmin.from('settlements').select(`id, ${fileField}`)
            .eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear).is('plan_id', null).maybeSingle()
      const [, { data: settle }, { data: profile }] = await Promise.all([
        updateCR,
        settleQ,
        supabaseAdmin.from('user_profiles')
          .select('email, contact_name, contact_title, contact_phone')
          .eq('school_id', cr.school_id).eq('is_admin', false).single(),
      ])

      // 重新上傳時刪除舊檔（非阻斷）
      if (isReupload) {
        const oldPath = (settle?.[fileField as keyof typeof settle] ?? null) as string | null
        if (oldPath) {
          const deleteOld = !oldPath.includes('/') && gasUrl
            ? gasDeleteFile({ gasUrl, gasSecret, fileId: oldPath })
            : supabaseAdmin.storage.from(BUCKET).remove([oldPath])
          deleteOld.catch(e => console.error('change-requests:', e))
        }
      }

      const updateData: Record<string, unknown> = { [fileField]: cr.pending_file_path, updated_at: now }
      if (isScan) { updateData.scan_uploaded_at = now; updateData.status = 'uploaded' }
      else {
        const dateMatch = (cr.reason || '').match(/^DATE:(\S+)/)
        if (dateMatch) updateData.remittance_date = dateMatch[1]
      }

      if (settle) {
        const updateQ = cr.plan_id
          ? supabaseAdmin.from('settlements').update(updateData)
              .eq('school_id', cr.school_id).eq('plan_id', cr.plan_id)
              .eq('semester', cr.semester).eq('school_year', schoolYear)
          : supabaseAdmin.from('settlements').update(updateData)
              .eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear).is('plan_id', null)
        await updateQ
      } else {
        await supabaseAdmin.from('settlements').insert({
          school_id: cr.school_id, semester: cr.semester, school_year: schoolYear,
          ...(cr.plan_id ? { plan_id: cr.plan_id } : {}),
          ...updateData,
        })
      }

      // 寄信（非阻斷）
      sendReviewEmail({ profile, allSettings, gasUrl, gasSecret, cr, schoolName, admin_note, isApproved: true }).catch(() => {})
    }

  } else if (action === 'rejected') {
    const isReuploadReject = cr.request_type === 'scan_reupload' || cr.request_type === 'remittance_reupload'
    const isScanReject = cr.request_type === 'scan_reupload'
    const existingFileField = isScanReject ? 'scan_file_path' : 'remittance_file_path'

    // 刪除待審的 pending 檔案
    const deletePending = cr.pending_file_path && gasUrl && !cr.pending_file_path.includes('/')
      ? gasDeleteFile({ gasUrl, gasSecret, fileId: cr.pending_file_path })
      : Promise.resolve()

    const [, , { data: profile }] = await Promise.all([
      updateCR,
      deletePending.catch(e => console.error('change-requests reject:', e)),
      supabaseAdmin.from('user_profiles')
        .select('email, contact_name, contact_title, contact_phone')
        .eq('school_id', cr.school_id).eq('is_admin', false).single(),
    ])

    // reupload 被拒絕：同時清除原本已核准的檔案
    if (isReuploadReject) {
      const settleQ = cr.plan_id
        ? supabaseAdmin.from('settlements').select(`id, ${existingFileField}`)
            .eq('school_id', cr.school_id).eq('plan_id', cr.plan_id)
            .eq('semester', cr.semester).eq('school_year', schoolYear).maybeSingle()
        : supabaseAdmin.from('settlements').select(`id, ${existingFileField}`)
            .eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear).is('plan_id', null).maybeSingle()
      const { data: settle } = await settleQ
      if (settle) {
        const oldPath = (settle as Record<string, unknown>)[existingFileField] as string | null
        // 刪除舊的已核准檔案（非阻斷）
        if (oldPath) {
          const del = !oldPath.includes('/') && gasUrl
            ? gasDeleteFile({ gasUrl, gasSecret, fileId: oldPath })
            : supabaseAdmin.storage.from(BUCKET).remove([oldPath])
          del.catch(e => console.error('delete old approved file:', e))
        }
        // 清除 settlement 的檔案欄位
        const clearData: Record<string, unknown> = { [existingFileField]: null, updated_at: now }
        if (isScanReject) clearData.status = 'downloaded'
        await supabaseAdmin.from('settlements').update(clearData).eq('id', (settle as { id: string }).id)
      }
    }

    // 寄信
    await sendReviewEmail({ profile, allSettings, gasUrl, gasSecret, cr, schoolName, admin_note, isApproved: false })
  }

  return NextResponse.json({ ok: true })
}

// 共用寄信函式，避免重複程式碼
async function sendReviewEmail({ profile, allSettings, gasUrl, gasSecret, cr, schoolName, admin_note, isApproved }: {
  profile: { email: string; contact_name?: string; contact_title?: string; contact_phone?: string } | null
  allSettings: Record<string, string | string[]>
  gasUrl: string; gasSecret: string
  cr: Record<string, unknown>
  schoolName: string; admin_note?: string; isApproved: boolean
}) {
  if (!profile?.email || !gasUrl) return

  const typeLabel = (() => {
    const rt = cr.request_type as string
    const amt = cr.new_amount as number | null
    if (rt === 'amount_modify') return `實支金額修改${amt != null ? `（${isApproved ? '修改為' : '申請金額'} NT$ ${Number(amt).toLocaleString()} 元）` : ''}`
    return { scan_upload: '首次上傳經費收支結算表掃描檔', scan_reupload: '經費收支結算表掃描檔重新上傳', remittance_upload: '首次上傳賸餘款送款憑單', remittance_reupload: '賸餘款送款憑單重新上傳' }[rt] || rt
  })()

  const { planLabel, planName } = cr.plan_id ? await (async () => {
    const { data: p } = await supabaseAdmin.from('plans').select('label, name').eq('id', cr.plan_id as string).single()
    return { planLabel: p?.label || '', planName: p?.name || p?.label || '' }
  })() : { planLabel: '', planName: '' }
  const semLabel = planLabel ? `${planLabel}（第${cr.semester}學期）` : `第${cr.semester}學期`
  const adminNote = admin_note?.trim()
    ? `${isApproved ? '承辦備註' : '退回原因'}：${admin_note.trim()}\n\n`
    : ''
  const actionNote = isApproved
    ? (cr.request_type === 'amount_modify' ? '請至系統重新下載經費收支結算表，並列印逐級核章後掃描上傳。' : '新上傳的檔案已生效，如有疑問請聯絡承辦人員。')
    : ''

  const tmplSubject = isApproved
    ? (allSettings.review_approve_subject || '【核銷系統】{semLabel}申請已核准')
    : (allSettings.review_reject_subject || '【核銷系統】{semLabel}申請未通過')
  const tmplBody = isApproved
    ? (allSettings.review_approve_body || '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請已核准通過。\n\n{actionNote}\n\n{adminNote}臺中市第2區免費營養午餐核銷系統')
    : (allSettings.review_reject_body || '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請未通過審核。\n\n{adminNote}如有疑問請聯絡承辦人員。\n\n臺中市第2區免費營養午餐核銷系統')

  const applyVars = (t: string) => t
    .replace(/\{contactName\}/g, profile.contact_name || schoolName)
    .replace(/\{contactTitle\}/g, profile.contact_title || '')
    .replace(/\{schoolName\}/g, schoolName)
    .replace(/\{semLabel\}/g, semLabel)
    .replace(/\{typeLabel\}/g, typeLabel)
    .replace(/\{actionNote\}/g, actionNote)
    .replace(/\{adminNote\}/g, adminNote)
    .replace(/\{adminName\}/g, String(allSettings.admin_name || ''))
    .replace(/\{adminTitle\}/g, String(allSettings.admin_title || ''))
    .replace(/\{adminPhone\}/g, String(allSettings.admin_phone || ''))
    .replace(/\{hostSchool\}/g, String(allSettings.host_school || ''))
    .replace(/\{zoneName\}/g, String(allSettings.system_name || ''))
    .replace(/\{planLabel\}/g, planLabel)
    .replace(/\{planName\}/g, planName)

  const plainBody = applyVars(String(tmplBody))
  const globalSystemName = await getGlobalSystemName()
  const htmlBody = wrapEmailHtml({
    body: plainBody,
    zoneName: zoneShortName,
    systemName: globalSystemName,
    hostSchool: String(allSettings.host_school || ''),
    adminName: String(allSettings.admin_name || ''),
    adminTitle: String(allSettings.admin_title || ''),
    adminPhone: String(allSettings.admin_phone || ''),
  })

  await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'notify', secret: gasSecret, to: profile.email, subject: applyVars(String(tmplSubject)), body: plainBody, htmlBody, noReply: true }),
  })
}

import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getGasSettings, gasDeleteFile } from '@/lib/gas'
import { calcRatio, calcSurplus, calcRepay } from '@/lib/utils'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

async function getContact(email: string) {
  try {
    const safe = email.replace('@', '_at_').replace(/\./g, '_')
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(`__contacts/${safe}.json`)
    if (data) return JSON.parse(await data.text())
  } catch { /* ignore */ }
  return {}
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const schoolYear = await getActiveSchoolYear()
  const { data: requests } = await supabaseAdmin
    .from('change_requests')
    .select('*, schools(name, code, district)')
    .eq('school_year', schoolYear)
    .order('created_at', { ascending: false })

  if (!requests) return NextResponse.json([])

  // 取出需要補充現有資料的申請
  const needSettleData = requests.filter(r =>
    r.request_type === 'scan_reupload' ||
    r.request_type === 'remittance_reupload' ||
    r.request_type === 'amount_modify'
  )

  let settleMap: Record<string, { scan_file_path: string | null; remittance_file_path: string | null; business_expense: number | null }> = {}
  let approvedAmountMap: Record<string, { sem1_amount: number; sem2_amount: number }> = {}

  if (needSettleData.length > 0) {
    const schoolIds = [...new Set(needSettleData.map(r => r.school_id))]

    const [{ data: settles }, { data: amounts }] = await Promise.all([
      supabaseAdmin
        .from('settlements')
        .select('school_id, semester, scan_file_path, remittance_file_path, business_expense')
        .eq('school_year', schoolYear)
        .in('school_id', schoolIds),
      supabaseAdmin
        .from('school_amounts')
        .select('school_id, sem1_amount, sem2_amount')
        .eq('school_year', schoolYear)
        .in('school_id', schoolIds),
    ])

    for (const s of settles ?? []) {
      settleMap[`${s.school_id}_${s.semester}`] = {
        scan_file_path: s.scan_file_path,
        remittance_file_path: s.remittance_file_path,
        business_expense: s.business_expense,
      }
    }
    for (const a of amounts ?? []) {
      approvedAmountMap[String(a.school_id)] = { sem1_amount: a.sem1_amount, sem2_amount: a.sem2_amount }
    }
  }

  const enriched = requests.map(r => {
    const settle = settleMap[`${r.school_id}_${r.semester}`]
    const amtRow = approvedAmountMap[String(r.school_id)]
    const approved_amount = r.semester === 1 ? (amtRow?.sem1_amount ?? null) : (amtRow?.sem2_amount ?? null)

    if (r.request_type === 'scan_reupload' || r.request_type === 'remittance_reupload') {
      const existing_file_path = r.request_type === 'scan_reupload'
        ? (settle?.scan_file_path ?? null)
        : (settle?.remittance_file_path ?? null)
      return { ...r, existing_file_path, existing_amount: null, approved_amount: null }
    }
    if (r.request_type === 'amount_modify') {
      return { ...r, existing_file_path: null, existing_amount: settle?.business_expense ?? null, approved_amount }
    }
    return { ...r, existing_file_path: null, existing_amount: null, approved_amount: null }
  })

  return NextResponse.json(enriched)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { id, action, admin_note } = await req.json()
  if (!id || !action) return NextResponse.json({ error: '資料不完整' }, { status: 400 })

  const { data: cr } = await supabaseAdmin
    .from('change_requests').select('*, schools(name)').eq('id', id).single()
  if (!cr) return NextResponse.json({ error: '找不到申請' }, { status: 404 })
  if (cr.status !== 'pending') return NextResponse.json({ error: '已審核' }, { status: 409 })

  const schoolYear = await getActiveSchoolYear()
  const now = new Date().toISOString()

  await supabaseAdmin.from('change_requests').update({
    status: action,
    admin_note: admin_note?.trim() || null,
    reviewed_at: now,
    reviewed_by: session.user.email,
  }).eq('id', id)

  if (action === 'approved') {
    if (cr.request_type === 'amount_modify') {
      const { data: amountRow } = await supabaseAdmin
        .from('school_amounts').select('sem1_amount, sem2_amount')
        .eq('school_id', cr.school_id).eq('school_year', schoolYear).single()
      const A = cr.semester === 1 ? (amountRow?.sem1_amount || 0) : (amountRow?.sem2_amount || 0)
      const D = cr.new_amount
      const C = calcRatio(A, A)
      const E = calcSurplus(A, D)
      const F = calcRepay(E, C)

      await supabaseAdmin.from('settlements').update({
        business_expense: D,
        total_expense: D,
        surplus: E,
        repay_amount: F,
        amount_locked: true,
        updated_at: now,
      }).eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear)

    } else if (
      cr.request_type === 'scan_reupload' || cr.request_type === 'remittance_reupload' ||
      cr.request_type === 'scan_upload' || cr.request_type === 'remittance_upload'
    ) {
      const isScan = cr.request_type === 'scan_reupload' || cr.request_type === 'scan_upload'
      const fileField = isScan ? 'scan_file_path' : 'remittance_file_path'
      const isReupload = cr.request_type === 'scan_reupload' || cr.request_type === 'remittance_reupload'

      // 若是重新上傳，先刪除舊檔
      if (isReupload) {
        const { data: settle } = await supabaseAdmin
          .from('settlements').select(fileField)
          .eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear)
          .single()
        const oldPath = (settle?.[fileField as keyof typeof settle] ?? null) as string | null
        if (oldPath) {
          try {
            const { gasUrl, gasSecret } = await getGasSettings()
            if (gasUrl && !oldPath.includes('/')) {
              await gasDeleteFile({ gasUrl, gasSecret, fileId: oldPath })
            } else if (oldPath.includes('/')) {
              await supabaseAdmin.storage.from(BUCKET).remove([oldPath])
            }
          } catch { /* 忽略 */ }
        }
      }

      const updateData: Record<string, unknown> = {
        [fileField]: cr.pending_file_path,
        updated_at: now,
      }
      if (isScan) {
        updateData.scan_uploaded_at = now
        updateData.status = 'uploaded'
      } else if (cr.request_type === 'remittance_upload' || cr.request_type === 'remittance_reupload') {
        // 從 reason 欄位取出繳款日期 (格式: DATE:2027-07-12)
        const dateMatch = (cr.reason || '').match(/^DATE:(\S+)/)
        if (dateMatch) updateData.remittance_date = dateMatch[1]
      }

      const { data: existingSettle } = await supabaseAdmin
        .from('settlements').select('id')
        .eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear)
        .single()

      if (existingSettle) {
        await supabaseAdmin.from('settlements').update(updateData)
          .eq('school_id', cr.school_id).eq('semester', cr.semester).eq('school_year', schoolYear)
      } else {
        await supabaseAdmin.from('settlements').insert({
          school_id: cr.school_id,
          semester: cr.semester,
          school_year: schoolYear,
          ...updateData,
        })
      }
    }

    // 核准後寄信給學校承辦人
    try {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles').select('email')
        .eq('school_id', cr.school_id).eq('is_admin', false).single()

      if (profile?.email) {
        const { gasUrl, gasSecret } = await getGasSettings()
        if (gasUrl) {
          // 讀取信件範本
          const { data: settingsFile } = await supabaseAdmin.storage
            .from('settlement-files').download('__system/settings.json')
          let tmplSubject = '【核銷系統】{semLabel}申請已核准'
          let tmplBody = '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請已核准通過。\n\n{actionNote}\n\n{adminNote}臺中市第2區免費營養午餐核銷系統'
          if (settingsFile) {
            try {
              const s = JSON.parse(await settingsFile.text())
              if (s.review_approve_subject) tmplSubject = s.review_approve_subject
              if (s.review_approve_body) tmplBody = s.review_approve_body
            } catch { /* 忽略 */ }
          }

          const contact = await getContact(profile.email)
          const schoolName = (cr.schools as unknown as { name: string } | null)?.name || ''
          const semLabel = `第${cr.semester}學期`
          const typeLabel = cr.request_type === 'amount_modify'
            ? `實支金額修改${cr.new_amount != null ? `（修改為 NT$ ${Number(cr.new_amount).toLocaleString()} 元）` : ''}`
            : cr.request_type === 'scan_upload'
            ? '首次上傳經費收支結算表掃描檔'
            : cr.request_type === 'scan_reupload'
            ? '經費收支結算表掃描檔重新上傳'
            : cr.request_type === 'remittance_upload'
            ? '首次上傳賸餘款送款憑單'
            : '賸餘款送款憑單重新上傳'
          const actionNote = cr.request_type === 'amount_modify'
            ? '請至系統重新下載經費收支結算表，並列印逐級核章後掃描上傳。'
            : '新上傳的檔案已生效，如有疑問請聯絡承辦人員。'
          const adminNoteLine = admin_note?.trim() ? `承辦備註：${admin_note.trim()}\n\n` : ''

          function applyVars(tmpl: string) {
            return tmpl
              .replace(/\{contactName\}/g, contact.contact_name || schoolName)
              .replace(/\{contactTitle\}/g, contact.contact_title || '')
              .replace(/\{schoolName\}/g, schoolName)
              .replace(/\{semLabel\}/g, semLabel)
              .replace(/\{typeLabel\}/g, typeLabel)
              .replace(/\{actionNote\}/g, actionNote)
              .replace(/\{adminNote\}/g, adminNoteLine)
          }

          const subject = applyVars(tmplSubject)
          const body = applyVars(tmplBody)

          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'notify', secret: gasSecret, to: profile.email, subject, body }),
          })
        }
      }
    } catch { /* 寄信失敗不阻斷審核 */ }

  } else if (action === 'rejected') {
    // 刪除待審暫存檔案
    if (cr.pending_file_path) {
      try {
        const { gasUrl, gasSecret } = await getGasSettings()
        if (gasUrl && !cr.pending_file_path.includes('/')) {
          await gasDeleteFile({ gasUrl, gasSecret, fileId: cr.pending_file_path })
        }
      } catch { /* 忽略 */ }
    }

    // 寄拒絕通知信
    try {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles').select('email')
        .eq('school_id', cr.school_id).eq('is_admin', false).single()

      if (profile?.email) {
        const { gasUrl, gasSecret } = await getGasSettings()
        if (gasUrl) {
          const { data: settingsFile } = await supabaseAdmin.storage
            .from('settlement-files').download('__system/settings.json')
          let tmplSubject = '【核銷系統】{semLabel}申請未通過'
          let tmplBody = '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請未通過審核。\n\n{adminNote}如有疑問請聯絡承辦人員。\n\n臺中市第2區免費營養午餐核銷系統'
          if (settingsFile) {
            try {
              const s = JSON.parse(await settingsFile.text())
              if (s.review_reject_subject) tmplSubject = s.review_reject_subject
              if (s.review_reject_body) tmplBody = s.review_reject_body
            } catch { /* 忽略 */ }
          }

          const contact = await getContact(profile.email)
          const schoolName = (cr.schools as unknown as { name: string } | null)?.name || ''
          const semLabel = `第${cr.semester}學期`
          const typeLabel = cr.request_type === 'amount_modify'
            ? `實支金額修改${cr.new_amount != null ? `（申請金額 NT$ ${Number(cr.new_amount).toLocaleString()} 元）` : ''}`
            : cr.request_type === 'scan_upload'
            ? '首次上傳經費收支結算表掃描檔'
            : cr.request_type === 'scan_reupload'
            ? '經費收支結算表掃描檔重新上傳'
            : cr.request_type === 'remittance_upload'
            ? '首次上傳賸餘款送款憑單'
            : '賸餘款送款憑單重新上傳'
          const adminNoteLine = admin_note?.trim() ? `退回原因：${admin_note.trim()}\n\n` : ''

          function applyVars(tmpl: string) {
            return tmpl
              .replace(/\{contactName\}/g, contact.contact_name || schoolName)
              .replace(/\{contactTitle\}/g, contact.contact_title || '')
              .replace(/\{schoolName\}/g, schoolName)
              .replace(/\{semLabel\}/g, semLabel)
              .replace(/\{typeLabel\}/g, typeLabel)
              .replace(/\{adminNote\}/g, adminNoteLine)
          }

          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'notify', secret: gasSecret, to: profile.email,
              subject: applyVars(tmplSubject),
              body: applyVars(tmplBody),
            }),
          })
        }
      }
    } catch { /* 寄信失敗不阻斷 */ }
  }

  return NextResponse.json({ ok: true })
}

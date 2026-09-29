import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasDeleteFile } from '@/lib/gas'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'

const BUCKET = 'settlement-files'
const PATH = '__system/batch-merge.json'

export interface BatchMergePart { fileId: string; filename: string; errors: string[] }
export interface BatchMergeRecord {
  total: number
  partCount: number
  generatedAt: string
  parts: Record<string, BatchMergePart>
}

async function readAll(): Promise<Record<string, BatchMergeRecord>> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(PATH)
    if (data) return JSON.parse(await data.text())
  } catch { /* 尚無記錄 */ }
  return {}
}

async function writeAll(all: Record<string, BatchMergeRecord>) {
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(PATH, blob, { upsert: true, contentType: 'application/json' })
  if (error) throw new Error(error.message)
}

// 記錄範圍：超級管理者看全部；區管理者只看自己分區（清單內容不同，不能共用同一份合併檔）
export async function batchMergeKey(opts: {
  userEmail: string; type: string; semester: number; planId: string | null; schoolYear: string
}) {
  const zoneUser = await getUserZoneRole(opts.userEmail)
  const allowed = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  const scope = allowed === null ? 'all' : `zone${zoneUser?.zone_id ?? 'x'}`
  return `${opts.schoolYear}|${opts.type}|${opts.semester}|${opts.planId || '-'}|${scope}`
}

export async function getBatchMergeRecord(key: string) {
  const rec = (await readAll())[key] || null
  const complete = !!rec && Object.keys(rec.parts).length === rec.partCount
  return { record: rec, complete }
}

// 記錄一份合併結果；重新合併（part=1）時先清掉舊記錄並刪除舊檔（best-effort）
export async function saveBatchMergePart(key: string, p: {
  part: number; total: number; partCount: number; fileId: string; filename: string; errors: string[]
}) {
  const all = await readAll()
  let rec = all[key]
  const toDelete: string[] = []
  if (!rec || p.part === 1 || rec.partCount !== p.partCount) {
    if (rec) toDelete.push(...Object.values(rec.parts).map(x => x.fileId))
    rec = { total: p.total, partCount: p.partCount, generatedAt: new Date().toISOString(), parts: {} }
  } else {
    const old = rec.parts[String(p.part)]
    if (old) toDelete.push(old.fileId)
    rec.total = p.total
    rec.generatedAt = new Date().toISOString()
  }
  rec.parts[String(p.part)] = { fileId: p.fileId, filename: p.filename, errors: p.errors }
  all[key] = rec
  await writeAll(all)

  if (toDelete.length > 0) {
    const { gasUrl, gasSecret } = await getGasSettings()
    if (gasUrl) await Promise.all(toDelete.map(fileId => gasDeleteFile({ gasUrl, gasSecret, fileId }).catch(() => {})))
  }
}

import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

// GET — 下載 CSV 範本
export async function GET() {
  const header = 'code,district,name,zone_id\n'
  const example = '101,豐原區,豐原國民小學,1\n102,東勢區,東勢國民小學,2\n'
  return new Response(header + example, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="schools_import_template.csv"',
    },
  })
}

// POST — 批次匯入學校（CSV）
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const text = await req.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return NextResponse.json({ error: 'CSV 格式錯誤，至少需要標題行和一列資料' }, { status: 400 })

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const codeIdx = header.indexOf('code')
  const districtIdx = header.indexOf('district')
  const nameIdx = header.indexOf('name')
  const zoneIdx = header.indexOf('zone_id')

  if (codeIdx < 0 || districtIdx < 0 || nameIdx < 0) {
    return NextResponse.json({ error: 'CSV 缺少必要欄位：code, district, name' }, { status: 400 })
  }

  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim())
    return {
      code: Number(cols[codeIdx]),
      district: cols[districtIdx],
      name: cols[nameIdx],
      zone_id: zoneIdx >= 0 && cols[zoneIdx] ? Number(cols[zoneIdx]) : 2,
    }
  }).filter(r => r.code && r.name)

  if (rows.length === 0) return NextResponse.json({ error: '沒有有效資料行' }, { status: 400 })

  let inserted = 0, updated = 0, errors: string[] = []

  for (const row of rows) {
    // 依 code 判斷是新增還是更新
    const { data: existing } = await supabaseAdmin
      .from('schools').select('id').eq('code', row.code).single()

    if (existing) {
      const { error } = await supabaseAdmin
        .from('schools')
        .update({ district: row.district, name: row.name, zone_id: row.zone_id })
        .eq('id', existing.id)
      if (error) errors.push(`${row.code} ${row.name}: ${error.message}`)
      else updated++
    } else {
      const { error } = await supabaseAdmin
        .from('schools')
        .insert({ code: row.code, district: row.district, name: row.name, zone_id: row.zone_id, is_active: true, approved_total: 0, sem1_amount: 0, sem2_amount: 0 })
      if (error) errors.push(`${row.code} ${row.name}: ${error.message}`)
      else inserted++
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}

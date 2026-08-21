'use client'
import { useState, useEffect } from 'react'
import { BlockSpinner, Spinner } from '@/components/Spinner'

interface Zone {
  id: number
  name: string
  host_school: string
  host_email: string
  is_active: boolean
}

interface AdminRole { id: string; email: string; role: string; zone_id: number | null }
interface ZoneOverview {
  zone_id: number; zone_name: string; host_school: string
  total_schools: number; uploaded: number; in_progress: number; not_started: number
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
const ROLE_LABELS: Record<string, string> = { super_admin: '超級管理員', zone_admin: '區管理員', school: '學校' }

const ZONE_FIELDS: { key: string; label: string; placeholder?: string; section: string }[] = [
  // 基本資訊（存 zones 表）
  { key: '_zone_name',       label: '區別名稱',    placeholder: '台中市第X區',           section: 'basic' },
  { key: '_host_school',     label: '承辦學校',    placeholder: '臺中市○○國民小學',      section: 'basic' },
  { key: '_host_email',      label: '承辦學校信箱', placeholder: 'school@tc.edu.tw',      section: 'basic' },
  // 聯絡人
  { key: 'admin_name',       label: '承辦人姓名',  section: 'contact' },
  { key: 'admin_title',      label: '承辦人職稱',  section: 'contact' },
  { key: 'admin_phone',      label: '聯絡電話',    section: 'contact' },
  // 帳戶確認期程（學期初）
  { key: 'block1_open',      label: '帳戶確認開放', section: 'account' },
  { key: 'block1_deadline',  label: '帳戶確認截止說明', placeholder: '例：115學年度開學後',              section: 'account' },
]

const SECTION_LABELS: Record<string, string> = {
  basic: '基本資訊',
  contact: '聯絡人',
  account: '帳戶確認期程',
}

export default function ZonesTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [formLoading, setFormLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const [mainTab, setMainTab] = useState<'zones' | 'admins' | 'overview'>('zones')

  // 新增區別
  const [showAddZone, setShowAddZone] = useState(false)
  const [newZone, setNewZone] = useState({ name: '', host_school: '', host_email: '' })
  const [addingZone, setAddingZone] = useState(false)

  // 管理員角色
  const [admins, setAdmins] = useState<AdminRole[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ email: '', role: 'zone_admin', zone_id: 0 })
  const [adminMsg, setAdminMsg] = useState('')

  // 跨區總覽
  const [overviewData, setOverviewData] = useState<{ school_year: string; zones: ZoneOverview[] } | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)

  useEffect(() => { loadZones() }, [])
  useEffect(() => {
    if (mainTab === 'admins' && isSuperAdmin) loadAdmins()
    if (mainTab === 'overview' && isSuperAdmin) loadOverview()
  }, [mainTab])

  async function loadZones() {
    setLoading(true)
    const res = await fetch('/api/admin/zones')
    const data = await res.json()
    setZones(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function selectZone(zone: Zone) {
    setSelectedZone(zone)
    setFormLoading(true)
    const res = await fetch(`/api/admin/zone-settings?zone_id=${zone.id}`)
    const settings = await res.json()
    setForm({
      _zone_name: zone.name,
      _host_school: zone.host_school,
      _host_email: zone.host_email,
      _is_active: zone.is_active !== false ? 'true' : 'false',
      ...settings,
    })
    setFormLoading(false)
  }

  async function saveZone() {
    if (!selectedZone) return
    setSaving(true)

    // 分開存：zones 表 vs zone_settings
    const zoneBasic = { name: form._zone_name, host_school: form._host_school, host_email: form._host_email, is_active: form._is_active !== 'false' }
    const settings: Record<string, string> = {}
    for (const [k, v] of Object.entries(form)) {
      if (!k.startsWith('_')) settings[k] = v
    }

    await Promise.all([
      fetch('/api/admin/zones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedZone.id, ...zoneBasic }),
      }),
      fetch('/api/admin/zone-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: selectedZone.id, plan_id: null, settings }),
      }),
    ])

    // 更新本地 zones 列表
    const isActive = form._is_active !== 'false'
    setZones(prev => prev.map(z => z.id === selectedZone.id
      ? { ...z, name: form._zone_name || z.name, host_school: form._host_school || z.host_school, host_email: form._host_email || z.host_email, is_active: isActive }
      : z))
    setSelectedZone(prev => prev ? { ...prev, name: form._zone_name || prev.name, is_active: isActive } : prev)

    setSaving(false)
    setMsgOk(true); setMsg('✅ 設定已儲存')
    setTimeout(() => setMsg(''), 3000)
  }

  async function addZone() {
    if (!newZone.name) return
    setAddingZone(true)
    const res = await fetch('/api/admin/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newZone),
    })
    const data = await res.json()
    setAddingZone(false)
    if (data.id) { setShowAddZone(false); setNewZone({ name: '', host_school: '', host_email: '' }); loadZones() }
    else { setMsg('❌ ' + data.error); setMsgOk(false) }
  }

  async function loadAdmins() {
    setAdminsLoading(true)
    const res = await fetch('/api/admin/admin-roles')
    const data = await res.json()
    setAdmins(Array.isArray(data) ? data : [])
    setAdminsLoading(false)
  }

  async function addAdmin() {
    if (!newAdmin.email) return
    const res = await fetch('/api/admin/admin-roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAdmin),
    })
    const data = await res.json()
    if (data.ok) { setShowAddAdmin(false); setNewAdmin({ email: '', role: 'zone_admin', zone_id: zones[0]?.id || 0 }); loadAdmins() }
    else setAdminMsg('❌ ' + data.error)
  }

  async function removeAdmin(email: string) {
    if (!confirm(`確定移除 ${email} 的管理員權限？`)) return
    const res = await fetch('/api/admin/admin-roles', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (data.ok) loadAdmins()
    else setAdminMsg('❌ ' + data.error)
  }

  async function loadOverview() {
    setOverviewLoading(true)
    const res = await fetch('/api/admin/zone-overview')
    setOverviewData(await res.json())
    setOverviewLoading(false)
  }

  if (loading) return <BlockSpinner />

  const sections = [...new Set(ZONE_FIELDS.map(f => f.section))]

  return (
    <div className="space-y-4">
      {/* 主分頁切換 */}
      {isSuperAdmin && (
        <div className="flex gap-2">
          {(['zones', 'overview'] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t as 'zones' | 'admins' | 'overview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${mainTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
              {t === 'zones' ? '🗺️ 區別設定' : '📊 跨區總覽'}
            </button>
          ))}
        </div>
      )}

      {/* ── 區別設定 ── */}
      {mainTab === 'zones' && (
        <div className="flex gap-4">
          {/* 左側：區別清單 */}
          <div className="w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">區別清單</span>
                {isSuperAdmin && (
                  <button onClick={() => setShowAddZone(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">＋ 新增</button>
                )}
              </div>
              {zones.map(zone => (
                <button key={zone.id} onClick={() => selectZone(zone)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 transition-colors ${selectedZone?.id === zone.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'} ${zone.is_active === false ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    {zone.name}
                    {zone.is_active === false && <span className="text-xs text-gray-400 font-normal">（停用）</span>}
                  </div>
                  <div className="text-xs text-gray-400 font-normal truncate">{zone.host_school}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 右側：設定表單 */}
          <div className="flex-1">
            {!selectedZone ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                請從左側選擇區別
              </div>
            ) : formLoading ? <BlockSpinner /> : (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-800">{selectedZone.name} 設定</h2>
                    {isSuperAdmin && (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox"
                          checked={form._is_active !== 'false'}
                          onChange={e => setForm(prev => ({ ...prev, _is_active: e.target.checked ? 'true' : 'false' }))}
                          className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                        <span className={`ml-2 text-xs font-medium ${form._is_active !== 'false' ? 'text-green-600' : 'text-gray-400'}`}>
                          {form._is_active !== 'false' ? '啟用中' : '已停用'}
                        </span>
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {msg && <span className={`text-sm ${msgOk ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>}
                    <button onClick={saveZone} disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg cursor-pointer">
                      {saving ? '儲存中...' : '儲存設定'}
                    </button>
                  </div>
                </div>

                {sections.map(section => (
                  <div key={section}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                      {SECTION_LABELS[section]}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {ZONE_FIELDS.filter(f => f.section === section).map(f => {
                        const isToggle = f.key === 'block1_open'
                        const isOpen = form[f.key] !== 'false'
                        return (
                          <div key={f.key} className={f.key === 'system_name' ? 'col-span-2' : ''}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                            {isToggle ? (
                              <div className="flex items-center gap-3 py-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={isOpen}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.checked ? 'true' : 'false' }))}
                                    className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                                </label>
                                <span className={`text-sm font-medium ${isOpen ? 'text-green-600' : 'text-gray-400'}`}>
                                  {isOpen ? '開放中' : '已關閉'}
                                </span>
                              </div>
                            ) : (
                              <input
                                value={form[f.key] || ''}
                                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                className={inputCls}
                                placeholder={f.placeholder || ''}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 管理員角色 ── */}
      {mainTab === 'admins' && isSuperAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-800">管理員角色設定</h2>
            <button onClick={() => setShowAddAdmin(true)}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">＋ 新增管理員</button>
          </div>
          {adminMsg && <p className="text-sm text-red-600 mb-3">{adminMsg}</p>}
          {adminsLoading ? <div className="text-sm text-gray-400">載入中...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">角色</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">所屬區別</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map(a => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5">{a.email}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {ROLE_LABELS[a.role] || a.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {a.role === 'super_admin' ? '全部' : zones.find(z => z.id === a.zone_id)?.name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => removeAdmin(a.email)}
                        className="px-3 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer">移除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {showAddAdmin && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-96 space-y-3">
                <h3 className="text-base font-semibold">新增管理員</h3>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                  <input value={newAdmin.email} onChange={e => setNewAdmin(p => ({ ...p, email: e.target.value }))}
                    className={inputCls} placeholder="admin@example.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">角色</label>
                  <select value={newAdmin.role} onChange={e => setNewAdmin(p => ({ ...p, role: e.target.value }))} className={inputCls}>
                    <option value="super_admin">超級管理員</option>
                    <option value="zone_admin">區管理員</option>
                  </select>
                </div>
                {newAdmin.role === 'zone_admin' && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">所屬區別</label>
                    <select value={newAdmin.zone_id} onChange={e => setNewAdmin(p => ({ ...p, zone_id: Number(e.target.value) }))} className={inputCls}>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setShowAddAdmin(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">取消</button>
                  <button onClick={addAdmin} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">新增</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 跨區總覽 ── */}
      {mainTab === 'overview' && isSuperAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-800">
              跨區送件總覽
              {overviewData && <span className="ml-2 text-xs font-normal text-gray-400">{overviewData.school_year} 學年度</span>}
            </h2>
            <button onClick={loadOverview} className="text-xs text-blue-600 hover:text-blue-800">重新整理</button>
          </div>
          {overviewLoading ? <div className="text-sm text-gray-400">載入中...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">區別</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">承辦學校</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">學校數</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">已上傳</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">進行中</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">未開始</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">進度</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(overviewData?.zones || []).map(z => {
                  const pct = z.total_schools > 0 ? Math.round((z.uploaded / z.total_schools) * 100) : 0
                  return (
                    <tr key={z.zone_id}>
                      <td className="px-3 py-2.5 font-medium">{z.zone_name}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{z.host_school}</td>
                      <td className="px-3 py-2.5 text-center">{z.total_schools}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{z.uploaded}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">{z.in_progress}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{z.not_started}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 新增區別 Modal */}
      {showAddZone && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h3 className="text-base font-semibold mb-4">新增區別</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">區別名稱</label>
                <input value={newZone.name} onChange={e => setNewZone(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="台中市第X區" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">承辦學校</label>
                <input value={newZone.host_school} onChange={e => setNewZone(p => ({ ...p, host_school: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">承辦學校信箱</label>
                <input value={newZone.host_email} onChange={e => setNewZone(p => ({ ...p, host_email: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowAddZone(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg">取消</button>
              <button onClick={addZone} disabled={addingZone} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-2">
                {addingZone ? <><Spinner />新增中...</> : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

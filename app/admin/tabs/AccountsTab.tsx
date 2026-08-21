'use client'
import { useState, useEffect } from 'react'
import { Spinner, BlockSpinner } from '@/components/Spinner'

interface AccountRow {
  id: string
  email: string
  school_id: number | null
  is_admin: boolean
  role?: string | null
  zone_id?: number | null
  contact_name?: string
  contact_title?: string
  contact_phone?: string
  schools?: { name: string; code: number; district: string } | null
}

interface Zone { id: number; name: string }

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超級管理員',
  zone_admin: '區管理員',
}

export default function AccountsTab({
  currentUserEmail,
  isSuperAdmin,
}: {
  currentUserEmail: string
  isSuperAdmin: boolean
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<Zone[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContact, setEditContact] = useState({ name: '', title: '', phone: '' })
  const [search, setSearch] = useState('')

  // 新增管理員
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdmin, setNewAdmin] = useState({ email: '', role: 'zone_admin', zone_id: 0 })
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [addError, setAddError] = useState('')

  // 登入紀錄
  interface LoginLog { id: string; email: string; school_name: string | null; is_admin: boolean; logged_in_at: string }
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [logSearch, setLogSearch] = useState('')
  const [logLoading, setLogLoading] = useState(true)

  const [subTab, setSubTab] = useState<'schools' | 'admins' | 'logs'>('schools')

  function loadAccounts() {
    setLoading(true)
    fetch('/api/admin/accounts').then(r => r.json()).then(data => {
      setAccounts(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }

  function loadLogs(q = '') {
    setLogLoading(true)
    fetch(`/api/admin/login-logs?limit=200${q ? `&search=${encodeURIComponent(q)}` : ''}`)
      .then(r => r.json()).then(d => { setLogs(Array.isArray(d) ? d : []); setLogLoading(false) })
  }

  useEffect(() => {
    loadAccounts()
    loadLogs()
    fetch('/api/admin/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []))
  }, [])

  async function handleAddAdmin() {
    if (!newAdmin.email) return
    setAddingAdmin(true); setAddError('')
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newAdmin.email, role: newAdmin.role, zone_id: newAdmin.role === 'zone_admin' ? newAdmin.zone_id : null }),
    })
    const data = await res.json()
    if (!res.ok) setAddError(data.error || '新增失敗')
    else { setShowAddAdmin(false); setNewAdmin({ email: '', role: 'zone_admin', zone_id: zones[0]?.id || 0 }); loadAccounts() }
    setAddingAdmin(false)
  }

  async function handleUpdateRole(email: string, role: string, zone_id: number | null) {
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { role, zone_id } }),
    })
    loadAccounts()
  }

  async function handleUnbind(email: string) {
    if (!confirm(`確定要解除 ${email} 的學校綁定？`)) return
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { school_id: null } }),
    })
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, school_id: null, schools: null } : a))
  }

  async function handleRevokeAdmin(email: string) {
    if (!confirm(`確定要撤銷 ${email} 的管理員權限？`)) return
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { is_admin: false, role: null, zone_id: null } }),
    })
    loadAccounts()
  }

  async function handleDelete(email: string) {
    if (!confirm(`確定要刪除帳號 ${email}？此操作無法復原。`)) return
    await fetch('/api/admin/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setAccounts(prev => prev.filter(a => a.email !== email))
  }

  async function handleSaveContact(email: string) {
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { contact_name: editContact.name, contact_title: editContact.title, contact_phone: editContact.phone } }),
    })
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, contact_name: editContact.name, contact_title: editContact.title, contact_phone: editContact.phone } : a))
    setEditingId(null)
  }

  if (loading) return <BlockSpinner />

  const adminAccounts = accounts.filter(a => a.is_admin)
  const schoolAccounts = accounts
    .filter(a => !a.is_admin)
    .filter(a => !search || a.email.includes(search) || a.schools?.name.includes(search) || String(a.schools?.code).includes(search))
    .sort((a, b) => (a.schools?.code ?? 9999) - (b.schools?.code ?? 9999))

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={subTabCls('schools')} onClick={() => setSubTab('schools')}>🏫 各校帳號</button>
        {isSuperAdmin && <button className={subTabCls('admins')} onClick={() => setSubTab('admins')}>🔑 管理員設定</button>}
        <button className={subTabCls('logs')} onClick={() => setSubTab('logs')}>📋 登入紀錄</button>
      </div>

      {/* 各校帳號 */}
      {subTab === 'schools' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
            <h2 className="font-semibold text-gray-800 whitespace-nowrap">各校綁定帳號</h2>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學校名稱、編號或 Email..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {schoolAccounts.length === 0 ? (
            <div className="text-center py-10 text-sm space-y-1">
              <p className="text-gray-400">尚無學校帳號</p>
              <p className="text-gray-300 text-xs">各校以 Google 帳號首次登入後，帳號資料會自動出現於此列表</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">綁定學校</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">承辦人 / 職稱 / 電話</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schoolAccounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{a.schools?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.schools ? <span>{a.schools.district}・{a.schools.name}</span> : <span className="text-gray-300">未綁定</span>}
                    </td>
                    <td className="px-4 py-3">{a.email}</td>
                    <td className="px-4 py-3">
                      {editingId === a.id ? (
                        <div className="flex gap-2">
                          <input value={editContact.name} onChange={e => setEditContact(p => ({ ...p, name: e.target.value }))}
                            placeholder="姓名" className="border rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-blue-400" />
                          <input value={editContact.title} onChange={e => setEditContact(p => ({ ...p, title: e.target.value }))}
                            placeholder="職稱" className="border rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-blue-400" />
                          <input value={editContact.phone} onChange={e => setEditContact(p => ({ ...p, phone: e.target.value }))}
                            placeholder="電話" className="border rounded px-2 py-1 text-xs w-32 outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">
                          {a.contact_name || '—'}
                          {a.contact_title ? `（${a.contact_title}）` : ''}
                          {a.contact_phone ? `　${a.contact_phone}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {editingId === a.id ? (
                          <>
                            <button onClick={() => handleSaveContact(a.email)}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700">儲存</button>
                            <button onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(a.id); setEditContact({ name: a.contact_name || '', title: a.contact_title || '', phone: a.contact_phone || '' }) }}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200">編輯</button>
                            {a.school_id && (
                              <button onClick={() => handleUnbind(a.email)}
                                className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded cursor-pointer hover:bg-orange-200">解綁</button>
                            )}
                            {a.email !== currentUserEmail && (
                              <button onClick={() => handleDelete(a.email)}
                                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded cursor-pointer hover:bg-red-200">刪除</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 管理員設定（僅超級管理員） */}
      {subTab === 'admins' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">設定各管理員的角色與所屬區別</p>
            <button onClick={() => setShowAddAdmin(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg cursor-pointer">
              ＋ 新增管理員
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">角色</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">所屬區別</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adminAccounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.email}</td>
                    <td className="px-4 py-3">
                      {a.email === currentUserEmail ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          {ROLE_LABELS[a.role || ''] || a.role || '管理員'}
                        </span>
                      ) : (
                        <select
                          value={a.role || 'zone_admin'}
                          onChange={e => handleUpdateRole(a.email, e.target.value, a.zone_id || null)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="super_admin">超級管理員</option>
                          <option value="zone_admin">區管理員</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.role === 'super_admin' || a.email === currentUserEmail ? (
                        <span className="text-gray-400 text-xs">{a.role === 'super_admin' ? '全部區別' : zones.find(z => z.id === a.zone_id)?.name || '—'}</span>
                      ) : (
                        <select
                          value={a.zone_id || ''}
                          onChange={e => handleUpdateRole(a.email, a.role || 'zone_admin', Number(e.target.value) || null)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">— 未指定 —</option>
                          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.email !== currentUserEmail && (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => handleRevokeAdmin(a.email)}
                            className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded cursor-pointer hover:bg-orange-200">撤銷管理員</button>
                          <button onClick={() => handleDelete(a.email)}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded cursor-pointer hover:bg-red-200">刪除</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 登入紀錄 */}
      {subTab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
            <h2 className="font-semibold text-gray-800 whitespace-nowrap">登入紀錄</h2>
            <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadLogs(logSearch)}
              placeholder="搜尋 Email 或學校名稱…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={() => loadLogs(logSearch)}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer whitespace-nowrap">搜尋</button>
          </div>
          {logLoading ? <BlockSpinner /> : logs.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">無紀錄</p>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">登入時間</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">綁定學校</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">身份</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(l.logged_in_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{l.email}</td>
                      <td className="px-4 py-2.5 text-gray-500">{l.school_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-center">
                        {l.is_admin
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">管理員</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">學校</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 新增管理員 Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 space-y-3">
            <h3 className="text-base font-semibold">新增管理員</h3>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
              <input value={newAdmin.email} onChange={e => setNewAdmin(p => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@gmail.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">角色</label>
              <select value={newAdmin.role} onChange={e => setNewAdmin(p => ({ ...p, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="super_admin">超級管理員</option>
                <option value="zone_admin">區管理員</option>
              </select>
            </div>
            {newAdmin.role === 'zone_admin' && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">所屬區別</label>
                <select value={newAdmin.zone_id} onChange={e => setNewAdmin(p => ({ ...p, zone_id: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            )}
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <p className="text-xs text-gray-400">尚未登入過的帳號也可先行設定，首次登入後即生效</p>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => { setShowAddAdmin(false); setAddError('') }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg">取消</button>
              <button onClick={handleAddAdmin} disabled={addingAdmin}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-2">
                {addingAdmin ? <><Spinner />新增中...</> : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

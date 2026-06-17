'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { formatAmount } from '@/lib/utils'

function PrintContent() {
  const params = useSearchParams()
  const schoolName = params.get('schoolName') || ''
  const sem = params.get('sem') || '1'
  const A = Number(params.get('A') || 0)
  const B = Number(params.get('B') || 0)
  const C = Number(params.get('C') || 0)
  const D = Number(params.get('D') || 0)
  const E = Number(params.get('E') || 0)
  const F = Number(params.get('F') || 0)
  const p = Number(params.get('p') || 0)
  const b = Number(params.get('b') || 0)
  const eq = Number(params.get('eq') || 0)

  const planName = `115學年度第${sem}學期公立國中小免費營養午餐計畫經費`

  useEffect(() => {
    // 短暫延遲後自動開啟列印對話框
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [])

  const rows = [
    { item: '人事費（經常門）', d: p },
    { item: '業務費（經常門）', d: b },
    { item: '設備及投資（資本門）', d: eq },
  ]

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          .no-print { display: none !important; }
          body { font-size: 11pt; }
        }
        body { font-family: '標楷體', 'DFKai-SB', serif; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #000; padding: 4px 8px; font-size: 11pt; }
        .title { text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 8px; }
        .subtitle { text-align: right; font-size: 10pt; margin-bottom: 4px; }
        .sign-row { margin-top: 40px; display: flex; justify-content: space-around; }
        .sign-cell { text-align: center; flex: 1; }
      `}</style>

      <div className="no-print mb-4 flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
        <span>📄</span>
        <div>
          <p className="font-medium">已產製收支結算表，請於瀏覽器列印後蓋章，再回系統上傳掃描檔。</p>
          <button onClick={() => window.print()} className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-blue-700 cursor-pointer">
            重新列印
          </button>
        </div>
      </div>

      <div className="title">{schoolName}經費收支結算表</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '11pt' }}>計畫名稱：{planName}</span>
        <span style={{ fontSize: '10pt' }}>單位：新臺幣元</span>
      </div>
      <div style={{ fontSize: '10pt', marginBottom: '8px' }}>百分比：取至小數點二位</div>

      <table>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ width: '18%' }}>核定項目</th>
            <th style={{ width: '14%' }}>核定計畫金額(A)</th>
            <th style={{ width: '14%' }}>核定補(捐)助金額(B)</th>
            <th style={{ width: '12%' }}>補助比率(C=B/A)</th>
            <th style={{ width: '14%' }}>實支總額(D)</th>
            <th style={{ width: '14%' }}>計畫結餘款(E=A-D)</th>
            <th style={{ width: '14%' }}>應繳回本局結餘款(F=E×C)(無條件進位)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.item}</td>
              <td style={{ textAlign: 'right' }}>{i === 0 ? formatAmount(A) : '-'}</td>
              <td style={{ textAlign: 'right' }}>{i === 0 ? formatAmount(B) : '-'}</td>
              <td style={{ textAlign: 'right' }}>{i === 0 ? `${(C * 100).toFixed(2)}%` : '-'}</td>
              <td style={{ textAlign: 'right' }}>{r.d > 0 ? formatAmount(r.d) : '-'}</td>
              <td style={{ textAlign: 'right' }}>{i === 0 ? formatAmount(E) : '-'}</td>
              <td style={{ textAlign: 'right' }}>{i === 0 ? formatAmount(F) : '-'}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 'bold', backgroundColor: '#f8f8f8' }}>
            <td>合計</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(A)}</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(B)}</td>
            <td style={{ textAlign: 'right' }}>{(C * 100).toFixed(2)}%</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(D)}</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(E)}</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(F)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '16px', border: '1px solid #000' }}>
        <table style={{ marginTop: 0 }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th colSpan={3} style={{ textAlign: 'left' }}>支出機關分攤表：</th>
              <th rowSpan={6} style={{ width: '40%', verticalAlign: 'top', textAlign: 'left', fontSize: '10pt', fontWeight: 'normal' }}>
                ◎倘涉及機關學校自籌款，請查填左列支出機關分攤表，其合計數應等於實支總額合計數。
              </th>
            </tr>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th>分攤機關名稱</th>
              <th>分攤金額（元）</th>
              <th>分攤比率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. 臺中市政府教育局</td>
              <td style={{ textAlign: 'right' }}>{formatAmount(D)}</td>
              <td style={{ textAlign: 'right' }}>100.00%</td>
            </tr>
            {[2, 3, 4].map(n => (
              <tr key={n}><td>{n}.</td><td></td><td></td></tr>
            ))}
            <tr style={{ fontWeight: 'bold' }}>
              <td>合計</td>
              <td style={{ textAlign: 'right' }}>{formatAmount(D)}</td>
              <td style={{ textAlign: 'right' }}>100.00%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="sign-row" style={{ marginTop: '48px' }}>
        <div className="sign-cell">
          <div>承辦單位</div>
          <div style={{ marginTop: '40px', borderTop: '1px solid #000', paddingTop: '4px' }}>&nbsp;</div>
        </div>
        <div className="sign-cell">
          <div>主辦會計</div>
          <div style={{ marginTop: '40px', borderTop: '1px solid #000', paddingTop: '4px' }}>&nbsp;</div>
        </div>
        <div className="sign-cell">
          <div>校長（機關/團體負責人）</div>
          <div style={{ marginTop: '40px', borderTop: '1px solid #000', paddingTop: '4px' }}>&nbsp;</div>
        </div>
      </div>
    </>
  )
}

export default function SettlementPrintPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<div>載入中...</div>}>
        <PrintContent />
      </Suspense>
    </div>
  )
}

import puppeteer from '/opt/homebrew/lib/node_modules/puppeteer/lib/puppeteer/puppeteer.js'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>超級使用者使用說明</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans TC', 'PingFang TC', sans-serif; font-size: 13px; color: #1e293b; background: white; }

  .cover {
    width: 100%; height: 100vh;
    background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #7c3aed 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; text-align: center; padding: 60px; position: relative;
    page-break-after: always; break-after: page;
  }
  .cover-icon { font-size: 72px; margin-bottom: 28px; }
  .cover-title { font-size: 34px; font-weight: 700; line-height: 1.3; margin-bottom: 12px; }
  .cover-subtitle { font-size: 17px; font-weight: 400; opacity: 0.8; margin-bottom: 36px; }
  .cover-badge { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 99px; padding: 8px 24px; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; }
  .cover-dot { width: 8px; height: 8px; border-radius: 50%; background: #c4b5fd; display: inline-block; }
  .cover-footer { position: absolute; bottom: 44px; font-size: 11px; opacity: 0.5; }

  .toc-page { padding: 48px 64px; page-break-after: always; break-after: page; }
  .toc-title { font-size: 26px; font-weight: 700; color: #7c3aed; border-bottom: 3px solid #7c3aed; padding-bottom: 14px; margin-bottom: 28px; }
  .toc-section { font-size: 14px; font-weight: 700; color: #7c3aed; margin: 20px 0 8px; }
  .toc-item { display: flex; align-items: baseline; margin-bottom: 10px; font-size: 13px; }
  .toc-num { color: #7c3aed; font-weight: 700; width: 32px; flex-shrink: 0; }
  .toc-label { color: #334155; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 8px; }
  .toc-page-num { color: #94a3b8; font-size: 11px; }

  .page { padding: 32px 54px 36px; page-break-after: always; break-after: page; position: relative; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
  .page-step { background: #7c3aed; color: white; width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
  .page-title { font-size: 19px; font-weight: 700; color: #7c3aed; }
  .page-footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 7px; }

  .desc { font-size: 12.5px; color: #475569; line-height: 1.8; margin-bottom: 10px; }
  .section-title { font-size: 14px; font-weight: 700; color: #7c3aed; margin: 14px 0 7px; }
  .steps { margin: 6px 0 12px; }
  .step-item { display: flex; gap: 10px; margin-bottom: 7px; align-items: flex-start; }
  .step-num { width: 22px; height: 22px; border-radius: 50%; background: #7c3aed; color: white; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .step-text { font-size: 12.5px; color: #334155; line-height: 1.7; flex: 1; }
  .step-text strong { color: #7c3aed; }
  .tip { background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 8px 0; font-size: 12px; color: #5b21b6; line-height: 1.6; break-inside: avoid; }
  .warn { background: #fff7ed; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 8px 0; font-size: 12px; color: #c2410c; line-height: 1.6; break-inside: avoid; }
  .info { background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 8px 0; font-size: 12px; color: #0369a1; line-height: 1.6; break-inside: avoid; }

  .table-wrap { margin: 10px 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f5f3ff; color: #5b21b6; font-weight: 600; padding: 7px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 12px; color: #334155; border-bottom: 1px solid #f1f5f9; line-height: 1.6; }
  tr:last-child td { border-bottom: none; }

  .btn-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
  .btn { border-radius: 8px; padding: 4px 11px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .btn-purple { background: #ede9fe; color: #7c3aed; }
  .btn-blue { background: #dbeafe; color: #1d4ed8; }
  .btn-green { background: #dcfce7; color: #15803d; }
  .btn-red { background: #fee2e2; color: #b91c1c; }
  .btn-gray { background: #f1f5f9; color: #475569; }
  .btn-orange { background: #ffedd5; color: #c2410c; }
  .btn-teal { background: #ccfbf1; color: #0f766e; }
  .btn-indigo { background: #e0e7ff; color: #4338ca; }

  .badge { border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; }
  .badge-purple { background: #ede9fe; color: #7c3aed; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-gray { background: #f1f5f9; color: #64748b; }
  .badge-red { background: #fee2e2; color: #b91c1c; }

  .role-card { border-radius: 10px; padding: 12px 16px; margin: 6px 0; break-inside: avoid; }
  .role-super { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1px solid #c4b5fd; }
  .role-zone { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; }
  .role-school { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; }
  .role-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .role-desc { font-size: 12px; color: #475569; line-height: 1.6; }

  .tab-bar { display: flex; gap: 4px; flex-wrap: wrap; margin: 10px 0 14px; }
  .tab { border-radius: 8px; padding: 5px 14px; font-size: 12px; font-weight: 600; }
  .tab-active { background: #7c3aed; color: white; }
  .tab-inactive { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .tab-special { background: #0f172a; color: #c4b5fd; }

  .qa-item { margin-bottom: 12px; break-inside: avoid; }
  .qa-q { font-weight: 700; color: #7c3aed; font-size: 12.5px; margin-bottom: 3px; }
  .qa-a { color: #475569; font-size: 12px; line-height: 1.7; padding-left: 14px; }
</style>
</head>
<body>

<!-- 封面 -->
<div class="cover">
  <div class="cover-icon">🔑</div>
  <div class="cover-title">臺中市午餐經費核銷系統<br>超級使用者操作說明</div>
  <div class="cover-subtitle">系統最高管理層級・全區別管理</div>
  <div class="cover-badge"><span class="cover-dot"></span>115 學年度・超級管理員專用</div>
  <div class="cover-footer">本說明書適用對象：系統超級管理員（super_admin）</div>
</div>

<!-- 目錄 -->
<div class="toc-page">
  <div class="toc-title">目錄</div>

  <div class="toc-section">系統角色與基本操作</div>
  <div class="toc-item"><span class="toc-num">一</span><span class="toc-label">角色說明與權限比較</span><span class="toc-dots"></span><span class="toc-page-num">3</span></div>
  <div class="toc-item"><span class="toc-num">二</span><span class="toc-label">登入與後台進入方式</span><span class="toc-dots"></span><span class="toc-page-num">4</span></div>
  <div class="toc-item"><span class="toc-num">三</span><span class="toc-label">後台分頁結構總覽</span><span class="toc-dots"></span><span class="toc-page-num">5</span></div>

  <div class="toc-section">區別管理（超級使用者專屬）</div>
  <div class="toc-item"><span class="toc-num">四</span><span class="toc-label">區別管理：新增 / 編輯 / 啟用停用</span><span class="toc-dots"></span><span class="toc-page-num">6</span></div>
  <div class="toc-item"><span class="toc-num">五</span><span class="toc-label">各區別設定：聯絡人與計畫設定</span><span class="toc-dots"></span><span class="toc-page-num">7</span></div>

  <div class="toc-section">核銷管理</div>
  <div class="toc-item"><span class="toc-num">六</span><span class="toc-label">核銷計畫管理</span><span class="toc-dots"></span><span class="toc-page-num">8</span></div>
  <div class="toc-item"><span class="toc-num">七</span><span class="toc-label">核銷期程設定 / 核定金額 / 通知信</span><span class="toc-dots"></span><span class="toc-page-num">9</span></div>

  <div class="toc-section">帳號與資料管理</div>
  <div class="toc-item"><span class="toc-num">八</span><span class="toc-label">帳號管理：指派區管理員</span><span class="toc-dots"></span><span class="toc-page-num">10</span></div>
  <div class="toc-item"><span class="toc-num">九</span><span class="toc-label">總覽、申請審核、匯出報表</span><span class="toc-dots"></span><span class="toc-page-num">11</span></div>
  <div class="toc-item"><span class="toc-num">附</span><span class="toc-label">常見問題 Q&amp;A</span><span class="toc-dots"></span><span class="toc-page-num">12</span></div>
</div>

<!-- ══ 第1頁：角色說明 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">一</div><div class="page-title">角色說明與權限比較</div></div>

  <p class="desc">系統共有三種角色。超級使用者（super_admin）為最高管理層級，可管理所有區別的資料，並擁有區別管理功能。</p>

  <div class="role-card role-super">
    <div class="role-title">🔑 超級使用者（super_admin）</div>
    <div class="role-desc">可管理所有區別・新增/停用區別・指派區管理員・查看全系統資料</div>
  </div>
  <div class="role-card role-zone">
    <div class="role-title">🏢 區管理者（zone_admin）</div>
    <div class="role-desc">僅能管理所屬區別的學校・核銷計畫・審核申請・無法跨區存取</div>
  </div>
  <div class="role-card role-school">
    <div class="role-title">🏫 學校帳號（school）</div>
    <div class="role-desc">填寫實支金額・上傳結算表與送款憑單・查看本校核定金額</div>
  </div>

  <div class="section-title">權限比較表</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>功能</th><th style="text-align:center">超級使用者</th><th style="text-align:center">區管理者</th><th style="text-align:center">學校</th></tr></thead>
      <tbody>
        <tr><td>區別管理（新增/編輯/停用）</td><td style="text-align:center"><span class="badge badge-purple">✓ 專屬</span></td><td style="text-align:center">—</td><td style="text-align:center">—</td></tr>
        <tr><td>指派區管理員帳號</td><td style="text-align:center"><span class="badge badge-purple">✓ 專屬</span></td><td style="text-align:center">—</td><td style="text-align:center">—</td></tr>
        <tr><td>查看所有區別的資料</td><td style="text-align:center">✓</td><td style="text-align:center">僅本區</td><td style="text-align:center">—</td></tr>
        <tr><td>各區別聯絡人設定</td><td style="text-align:center">✓ 所有區</td><td style="text-align:center">✓ 本區</td><td style="text-align:center">—</td></tr>
        <tr><td>核銷計畫管理</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td><td style="text-align:center">—</td></tr>
        <tr><td>核定金額管理</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td><td style="text-align:center">—</td></tr>
        <tr><td>申請審核</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td><td style="text-align:center">—</td></tr>
        <tr><td>匯出報表</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td><td style="text-align:center">—</td></tr>
        <tr><td>登入紀錄查詢</td><td style="text-align:center">✓ 全部</td><td style="text-align:center">✓ 本區</td><td style="text-align:center">—</td></tr>
        <tr><td>填寫實支金額、上傳檔案</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td></tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 3 頁</span></div>
</div>

<!-- ══ 第2頁：登入 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">二</div><div class="page-title">登入與後台進入方式</div></div>

  <p class="desc">超級使用者使用 Google 帳號登入系統，系統依 Email 自動識別角色並開放對應功能。</p>

  <div class="section-title">登入步驟</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">前往系統網址，點選「<strong>以 Google 帳號登入</strong>」</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">使用已設定為 super_admin 的 Gmail 帳號登入</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">登入後自動進入後台，導覽列出現六個主要分頁，並在右上角顯示「<strong>區別管理</strong>」tab（超級使用者專屬）</div></div>
  </div>

  <div class="info">💡 超級使用者角色由系統資料庫設定（user_profiles.role = 'super_admin'），如需新增超級使用者帳號，請至 Supabase 資料庫手動更新。</div>

  <div class="section-title">與區管理者的介面差異</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>項目</th><th>超級使用者</th><th>區管理者</th></tr></thead>
      <tbody>
        <tr><td>後台分頁</td><td>總覽 / 申請審核 / 核銷管理 / 帳號管理 / 學校管理 / 系統設定 + <strong>區別管理</strong></td><td>總覽 / 申請審核 / 核銷管理 / 帳號管理 / 學校管理 / 系統設定</td></tr>
        <tr><td>區別管理 tab</td><td>可新增/編輯/停用任何區別</td><td>僅可查看/編輯本區設定</td></tr>
        <tr><td>資料範圍</td><td>全區別</td><td>僅本區別</td></tr>
        <tr><td>帳號指派</td><td>可設定 zone_admin 並指派區別</td><td>無此功能</td></tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 4 頁</span></div>
</div>

<!-- ══ 第3頁：後台分頁 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">三</div><div class="page-title">後台分頁結構總覽</div></div>

  <p class="desc">超級使用者後台頂部顯示七個分頁，比區管理者多出「<strong>區別管理</strong>」。</p>

  <div class="tab-bar">
    <span class="tab tab-active">總覽</span>
    <span class="tab tab-inactive" style="background:#ede9fe;color:#7c3aed;border-color:#c4b5fd">申請審核</span>
    <span class="tab tab-inactive">核銷管理</span>
    <span class="tab tab-inactive">帳號管理</span>
    <span class="tab tab-inactive">學校管理</span>
    <span class="tab tab-inactive">系統設定</span>
    <span class="tab tab-special">★ 區別管理</span>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:20%">分頁</th><th style="width:35%">子分頁</th><th>功能說明</th></tr></thead>
      <tbody>
        <tr><td><strong>總覽</strong></td><td>—</td><td>各校核銷進度、計畫資訊卡切換、匯出報表</td></tr>
        <tr><td><strong>申請審核</strong></td><td>待審核 / 已通過 / 已拒絕</td><td>審核帳戶變更、檔案上傳、金額修改申請</td></tr>
        <tr><td rowspan="4"><strong>核銷管理</strong></td><td>核銷計畫管理</td><td>建立計畫、設定學期、全學年、扣抵規則</td></tr>
        <tr><td>核銷期程設定</td><td>各作業期間開放/關閉</td></tr>
        <tr><td>核定金額管理</td><td>依計畫批次匯入各校核定金額</td></tr>
        <tr><td>通知信範本</td><td>催收通知、審核通知信範本</td></tr>
        <tr><td><strong>帳號管理</strong></td><td>各校帳號 / 管理帳號 / 登入紀錄</td><td>帳號查詢、解綁、升降權限、指派區別</td></tr>
        <tr><td><strong>學校管理</strong></td><td>學校清單 / 帳戶管理</td><td>學校新增停用、銀行帳戶維護</td></tr>
        <tr><td rowspan="2"><strong>系統設定</strong></td><td>基本設定</td><td>系統名稱、承辦人、GAS 連線等</td></tr>
        <tr><td>學年度管理</td><td>切換學年度、備份、清除審核紀錄</td></tr>
        <tr><td><strong>★ 區別管理</strong></td><td>區別清單 / 各區別設定</td><td>新增/編輯/啟用停用區別；設定各區聯絡人</td></tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 5 頁</span></div>
</div>

<!-- ══ 第4頁：區別管理 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">四</div><div class="page-title">區別管理：新增 / 編輯 / 啟用停用</div></div>

  <p class="desc">路徑：後台 → <strong>★ 區別管理</strong>（超級使用者專屬）。管理全系統的區別清單，包含各區別的基本資訊與啟用狀態。</p>

  <div class="section-title">區別清單介面</div>
  <p class="desc">左側顯示所有區別清單，每筆資料顯示：區別名稱、承辦學校、啟用/停用狀態。</p>
  <div class="btn-row">
    <span class="btn btn-purple">+ 新增區別</span>
    <span class="btn btn-gray">選取區別 → 編輯/儲存</span>
  </div>

  <div class="section-title">新增區別步驟</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">點「<strong>+ 新增區別</strong>」開啟新增表單</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">填入「<strong>區別名稱</strong>」（例：臺中市第3區）、「<strong>承辦學校名稱</strong>」、「<strong>承辦聯絡信箱</strong>」</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">「<strong>啟用狀態</strong>」預設為啟用；若暫不對外開放，可切換為停用</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text">點「<strong>儲存區別</strong>」完成新增</div></div>
  </div>

  <div class="section-title">啟用 / 停用區別</div>
  <p class="desc">點選左側某個區別後，右側表單底部有「<strong>啟用狀態</strong>」切換開關（僅超級使用者可操作）：</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>狀態</th><th>前台顯示</th><th>後台影響</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-green">● 啟用中</span></td><td>登入頁底部顯示該區別的聯絡人資訊</td><td>正常運作</td></tr>
        <tr><td><span class="badge badge-gray">● 已停用</span></td><td>登入頁底部<strong>不顯示</strong>該區別的聯絡人資訊</td><td>區管理者仍可登入，但資訊對外隱藏</td></tr>
      </tbody>
    </table>
  </div>
  <p class="desc" style="margin-top:4px;">停用的區別在清單中以灰色顯示，名稱後方加註「（停用）」。</p>

  <div class="section-title">編輯區別基本資訊</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">點選左側清單中的區別，右側顯示該區別的表單</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">修改「區別名稱」、「承辦學校名稱」、「聯絡信箱」或「啟用狀態」</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">點「<strong>儲存區別</strong>」，修改即時生效</div></div>
  </div>

  <div class="warn">⚠️ 停用區別後，該區別登入頁底部的聯絡人資訊將立即對外隱藏。確認無誤後再執行。</div>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 6 頁</span></div>
</div>

<!-- ══ 第5頁：各區別設定 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">五</div><div class="page-title">各區別設定：聯絡人與計畫設定</div></div>

  <p class="desc">路徑：後台 → <strong>★ 區別管理</strong> → 點選區別 → 右側「<strong>區別設定</strong>」區塊。超級使用者可為任何區別設定聯絡人資訊與計畫相關設定。</p>

  <div class="section-title">選擇要設定的區別</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">在左側清單點選目標區別</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">右側頁面下半部顯示「<strong>區別設定</strong>」，可切換計畫</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">填入或修改設定後點「<strong>儲存設定</strong>」</div></div>
  </div>

  <div class="section-title">可設定的欄位</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:30%">欄位</th><th>說明</th><th style="width:25%">顯示位置</th></tr></thead>
      <tbody>
        <tr><td><strong>聯絡人姓名</strong></td><td>區別承辦人姓名</td><td>前台登入頁底部、通知信</td></tr>
        <tr><td><strong>聯絡人職稱</strong></td><td>區別承辦人職稱</td><td>前台登入頁底部、通知信</td></tr>
        <tr><td><strong>聯絡電話</strong></td><td>區別聯絡電話</td><td>前台登入頁底部、通知信</td></tr>
        <tr><td><strong>系統開放時間說明</strong></td><td>顯示於前台的開放說明文字</td><td>學校端首頁提示</td></tr>
        <tr><td><strong>計畫截止說明</strong></td><td>各計畫操作截止日期說明文字</td><td>學校端操作卡</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">計畫選擇</div>
  <p class="desc">若該區別有多個核銷計畫，頁面頂部顯示計畫選擇下拉，可為<strong>不同計畫</strong>分別設定不同的截止說明文字。聯絡人資訊屬區別層級（不分計畫），填一次即套用所有計畫。</p>

  <div class="tip">💡 前台（登入頁底部）顯示的聯絡人資訊來源優先順序：<br>
  1. 區別管理 → 區別設定 的聯絡人資訊（最優先）<br>
  2. 系統設定 → 基本設定 的承辦人資訊（備用）<br>
  請確認各區別設定已正確填入，避免顯示預設的全域設定。</div>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 7 頁</span></div>
</div>

<!-- ══ 第6頁：核銷計畫管理 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">六</div><div class="page-title">核銷計畫管理</div></div>

  <p class="desc">路徑：後台 → <strong>核銷管理 → 核銷計畫管理</strong>。超級使用者可管理所有區別的核銷計畫（需先切換至對應區別操作）。</p>

  <div class="section-title">計畫欄位說明</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:25%">欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>計畫名稱</strong></td><td>顯示於學校端資訊卡標題</td></tr>
        <tr><td><strong>短標籤</strong></td><td>顯示於後台計畫卡片與匯出報表</td></tr>
        <tr><td><strong>計畫類型</strong></td><td>第1學期 / 第2學期 / 全學年（跨兩學期，可設扣抵）</td></tr>
        <tr><td><strong>須繳回賸餘款</strong></td><td>勾選後學校端顯示「上傳賸餘款送款憑單」步驟</td></tr>
        <tr><td><strong>第1學期結餘扣抵第2學期</strong></td><td>僅全學年計畫可勾選；S1 結餘自動扣減 S2 核定金額</td></tr>
        <tr><td><strong>排序</strong></td><td>計畫卡片顯示順序（數字越小越前面）</td></tr>
        <tr><td><strong>啟用</strong></td><td>停用後不顯示於學校端，但資料保留</td></tr>
      </tbody>
    </table>
  </div>

  <div class="btn-row">
    <span class="btn btn-purple">+ 新增計畫</span>
    <span class="btn btn-gray">📋 建立預設計畫</span>
    <span class="btn btn-red">刪除計畫</span>
  </div>

  <div class="warn">⚠️ 刪除計畫會同時刪除該計畫的所有核定金額資料，此操作<strong>不可復原</strong>。若只是暫時不使用，建議改為「停用」。</div>

  <div class="section-title">全學年計畫扣抵說明</div>
  <p class="desc">選擇「全學年」並勾選「第1學期結餘扣抵第2學期」：</p>
  <div class="steps">
    <div class="step-item"><div class="step-num">▸</div><div class="step-text">學校端第2學期資訊卡顯示「扣第1學期結餘 NT$xxx，淨撥款：NT$xxx」</div></div>
    <div class="step-item"><div class="step-num">▸</div><div class="step-text">第1學期不顯示「上傳賸餘款送款憑單」步驟</div></div>
    <div class="step-item"><div class="step-num">▸</div><div class="step-text">後台總覽及匯出報表第1學期也不顯示送款憑單欄</div></div>
  </div>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 8 頁</span></div>
</div>

<!-- ══ 第7頁：期程/金額/通知 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">七</div><div class="page-title">核銷期程設定 / 核定金額管理 / 通知信範本</div></div>

  <div class="section-title">① 核銷期程設定</div>
  <p class="desc">路徑：核銷管理 → <strong>核銷期程設定</strong>。各期程可單獨「開放/關閉」並設定截止說明，關閉後學校端顯示「此階段尚未開放」。</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>期程</th><th>控制對象</th></tr></thead>
      <tbody>
        <tr><td>第1學期初（帳戶確認）</td><td>帳戶資訊變更申請的開放期間</td></tr>
        <tr><td>第1學期末（第1學期核銷）</td><td>第1學期「填寫實支金額」與「上傳結算表掃描檔」</td></tr>
        <tr><td>第2學期末（第2學期核銷）</td><td>第2學期「填寫實支金額」、「上傳結算表掃描檔」、「上傳賸餘款憑單」</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">② 核定金額管理</div>
  <p class="desc">路徑：核銷管理 → <strong>核定金額管理</strong>。依計畫分組顯示批次匯入區。</p>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">點「<strong>↓ 下載範本</strong>」取得含所有學校的 Excel 空白範本</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">在 Excel 填入各校核定金額，儲存後點「<strong>📥 批次匯入</strong>」上傳</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">匯入後「<strong>各校核定金額總覽</strong>」即時更新；也可點「✏️ 編輯金額」逐行手動修改</div></div>
  </div>

  <div class="section-title">③ 通知信範本</div>
  <p class="desc">路徑：核銷管理 → <strong>通知信範本</strong>。可設定三種信件的主旨與內文：催收通知、審核通過通知、審核拒絕通知。</p>
  <p class="desc">可用變數：<code>{schoolName}</code> <code>{contactName}</code> <code>{contactTitle}</code> <code>{semLabel}</code> <code>{planLabel}</code> <code>{adminName}</code> <code>{adminPhone}</code> <code>{hostSchool}</code></p>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 9 頁</span></div>
</div>

<!-- ══ 第8頁：帳號管理（指派區管理員） ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">八</div><div class="page-title">帳號管理：指派區管理員</div></div>

  <p class="desc">路徑：後台 → <strong>帳號管理</strong>。超級使用者除一般帳號管理外，還可將帳號設定為「區管理者（zone_admin）」並指派所屬區別。</p>

  <div class="section-title">新增區管理員步驟</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">至「<strong>帳號管理 → 系統管理帳號</strong>」子分頁</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">點「<strong>新增管理員</strong>」，填入對方的 Gmail 帳號</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">新增後在該帳號列點「<strong>編輯</strong>」，將角色設定為「<strong>區管理者</strong>」並在下拉選單選擇所屬區別</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text">儲存後，對方以該 Gmail 登入即可進入後台，操作範圍限制為指派的區別</div></div>
  </div>

  <div class="section-title">登入紀錄查詢</div>
  <p class="desc">路徑：帳號管理 → <strong>登入紀錄</strong>。超級使用者可查看全系統所有帳號的登入記錄：</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:20%">欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td>登入時間</td><td>精確到分鐘（台灣時間）</td></tr>
        <tr><td>Email</td><td>登入使用的 Google 帳號</td></tr>
        <tr><td>綁定學校</td><td>學校帳號顯示學校名稱；管理員帳號顯示「—」</td></tr>
        <tr><td>身份</td><td>管理員 / 學校</td></tr>
      </tbody>
    </table>
  </div>
  <p class="desc">可輸入 Email 或學校名稱搜尋，顯示最近 200 筆紀錄。</p>

  <div class="section-title">模擬身分</div>
  <p class="desc">後台右上角「<strong>👤 模擬身分</strong>」可選擇任一學校，在新分頁以該校身份進入學校端，方便確認學校所見的畫面與操作是否正確。確認後點「<strong>結束模擬</strong>」返回後台。</p>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 10 頁</span></div>
</div>

<!-- ══ 第9頁：總覽/審核/匯出 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">九</div><div class="page-title">總覽、申請審核、匯出報表</div></div>

  <div class="section-title">① 總覽</div>
  <p class="desc">路徑：後台 → <strong>總覽</strong>。顯示全區（超級使用者可跨區別）各校核銷進度，提供多種匯出功能。</p>
  <div class="btn-row">
    <span class="btn btn-teal">📋 匯款清冊 ▾</span>
    <span class="btn btn-purple">💰 賸餘款清冊</span>
    <span class="btn btn-indigo">📑 經費收支結算表</span>
    <span class="btn btn-gray">☁️ 雲端資料夾</span>
  </div>
  <p class="desc">各報表依目前選取的計畫與學期匯出，包含對應核定金額與動態計算的結餘、應繳回金額。</p>
  <p class="desc">「<strong>經費收支結算表</strong>」右上角顯示區別名稱，標題為該區別承辦學校名稱；若無選取特定計畫，則以所有學校加總計算。</p>

  <div class="section-title">② 申請審核</div>
  <p class="desc">路徑：後台 → <strong>申請審核</strong>。整合所有待審核事項，頁籤旁顯示待審件數。</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>申請類型</th><th>核准後</th></tr></thead>
      <tbody>
        <tr><td>帳戶變更申請</td><td>帳戶資料更新</td></tr>
        <tr><td>首次上傳掃描檔 / 送款憑單</td><td>檔案正式生效，學校首頁顯示 ✓</td></tr>
        <tr><td>重新上傳掃描檔 / 憑單</td><td>新檔取代舊檔，舊檔自動刪除</td></tr>
        <tr><td>實支金額修改申請</td><td>金額更新，E/F 欄自動重算</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">③ 批次發送催收通知</div>
  <p class="desc">在總覽勾選學校後，點「<strong>📧 催收通知（已選 N 校）</strong>」批次寄發提醒 Email。僅寄給有帳號綁定的學校，未綁定者自動略過。</p>

  <div class="section-title">④ 學年度管理</div>
  <p class="desc">路徑：系統設定 → <strong>學年度管理</strong>。新增學年度並點「新增並切換」後，需至：<br>
  ① 核銷計畫管理 建立新年度計畫 → ② 核定金額管理 批次匯入各校金額 → ③ 核銷期程設定 開放各期程</p>

  <div class="page-footer"><span>臺中市午餐核銷系統 · 超級使用者使用說明</span><span>第 11 頁</span></div>
</div>

<!-- ══ 附錄：Q&A ══ -->
<div class="page" style="page-break-after:auto;">
  <div class="page-header"><div class="page-step">附</div><div class="page-title">常見問題 Q&amp;A</div></div>

  <div class="qa-item">
    <div class="qa-q">如何新增一個新的區別？</div>
    <div class="qa-a">至「★ 區別管理」點「+ 新增區別」，填入區別名稱、承辦學校名稱、聯絡信箱，點「儲存區別」完成。新增後至「帳號管理 → 系統管理帳號」新增區管理員帳號並指派至新區別。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">如何設定區管理員帳號？</div>
    <div class="qa-a">至「帳號管理 → 系統管理帳號」，點「新增管理員」填入對方 Gmail，新增後點「編輯」將角色改為「區管理者」並指派所屬區別。對方以該 Gmail 登入後即可進入後台管理該區。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">前台登入頁底部的聯絡人資訊沒有更新？</div>
    <div class="qa-a">請至「★ 區別管理」→ 選取對應區別 → 右側「區別設定」填入聯絡人姓名、職稱、電話並點「儲存設定」。系統優先讀取此處設定，優先於全域的系統設定。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">停用某個區別後，該區的資料會消失嗎？</div>
    <div class="qa-a">不會。停用只影響前台登入頁是否顯示該區別的聯絡人資訊，後台所有資料（學校、核銷紀錄、帳號）均保留不變。區管理員仍可正常登入後台操作。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">如何確認某區別的前台顯示是否正確？</div>
    <div class="qa-a">點後台右上角「👤 模擬身分」選擇該區別的任一學校，在新分頁以學校身份開啟前台，確認登入頁底部聯絡人資訊是否正確。確認完畢點「結束模擬」返回後台。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">如何切換新學年度？</div>
    <div class="qa-a">至「系統設定 → 學年度管理」新增學年度並點「新增並切換」。接著至「核銷計畫管理」建立新年度計畫，「核定金額管理」批次匯入各校核定金額，「核銷期程設定」開放各期程。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">登入紀錄沒有顯示某帳號的記錄？</div>
    <div class="qa-a">登入紀錄僅記錄成功登入的帳號。若帳號從未登入（未觸發 Google 授權流程），則不會有記錄。請請對方重新登入後再查詢。</div>
  </div>

  <div style="margin-top:24px;background:linear-gradient(135deg,#4c1d95,#7c3aed);border-radius:12px;padding:16px 20px;color:white;">
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">系統維護與支援</div>
    <div style="font-size:12px;opacity:0.9;line-height:1.8;">超級使用者帳號（super_admin 角色）需由系統管理員在資料庫直接設定。<br>若遇系統異常請聯絡系統建置人員。</div>
  </div>

  <div style="text-align:center;margin-top:24px;font-size:11px;color:#94a3b8;">
    臺中市午餐核銷系統 · 超級使用者使用說明 · 115 學年度
  </div>
</div>

</body>
</html>`

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
})
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.evaluateHandle('document.fonts.ready')

const pdfBuffer = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
})

await browser.close()

const outPath = path.join(__dirname, '超級使用者使用說明.pdf')
writeFileSync(outPath, pdfBuffer)
console.log('✅ 超級使用者使用說明.pdf 已產生')

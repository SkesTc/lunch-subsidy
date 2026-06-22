import puppeteer from '/opt/homebrew/lib/node_modules/puppeteer/lib/puppeteer/puppeteer.js'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>後台管理者使用說明</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans TC', 'PingFang TC', sans-serif; font-size: 13px; color: #1e293b; background: white; }

  .cover {
    width: 100%; height: 100vh;
    background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; text-align: center; padding: 60px; position: relative;
    page-break-after: always; break-after: page;
  }
  .cover-icon { font-size: 72px; margin-bottom: 28px; }
  .cover-title { font-size: 34px; font-weight: 700; line-height: 1.3; margin-bottom: 12px; }
  .cover-subtitle { font-size: 17px; font-weight: 400; opacity: 0.8; margin-bottom: 36px; }
  .cover-badge { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 99px; padding: 8px 24px; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; }
  .cover-dot { width: 8px; height: 8px; border-radius: 50%; background: #86efac; display: inline-block; }
  .cover-footer { position: absolute; bottom: 44px; font-size: 11px; opacity: 0.5; }

  .toc-page { padding: 48px 64px; page-break-after: always; break-after: page; }
  .toc-title { font-size: 26px; font-weight: 700; color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 14px; margin-bottom: 28px; }
  .toc-section { font-size: 14px; font-weight: 700; color: #1e40af; margin: 20px 0 8px; }
  .toc-item { display: flex; align-items: baseline; margin-bottom: 10px; font-size: 13px; }
  .toc-num { color: #1e40af; font-weight: 700; width: 32px; flex-shrink: 0; }
  .toc-label { color: #334155; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 8px; }
  .toc-page-num { color: #94a3b8; font-size: 11px; }

  .page { padding: 34px 54px 38px; page-break-after: always; break-after: page; position: relative; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
  .page-step { background: #1e40af; color: white; width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
  .page-title { font-size: 19px; font-weight: 700; color: #1e40af; }
  .page-footer { margin-top: 18px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px; }

  .desc { font-size: 12.5px; color: #475569; line-height: 1.8; margin-bottom: 12px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1e40af; margin: 18px 0 8px; }
  .steps { margin: 8px 0 14px; }
  .step-item { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
  .step-num { width: 22px; height: 22px; border-radius: 50%; background: #1e40af; color: white; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .step-text { font-size: 12.5px; color: #334155; line-height: 1.7; flex: 1; }
  .step-text strong { color: #1e40af; }
  .tip { background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 10px 0; font-size: 12px; color: #0369a1; line-height: 1.6; break-inside: avoid; }
  .warn { background: #fff7ed; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 10px 0; font-size: 12px; color: #c2410c; line-height: 1.6; break-inside: avoid; }

  .table-wrap { margin: 12px 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; color: #475569; font-weight: 600; padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px 12px; color: #334155; border-bottom: 1px solid #f1f5f9; line-height: 1.6; }
  tr:last-child td { border-bottom: none; }

  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
  .btn { border-radius: 8px; padding: 5px 12px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .btn-blue { background: #dbeafe; color: #1d4ed8; }
  .btn-green { background: #dcfce7; color: #15803d; }
  .btn-teal { background: #ccfbf1; color: #0f766e; }
  .btn-purple { background: #ede9fe; color: #7c3aed; }
  .btn-indigo { background: #e0e7ff; color: #4338ca; }
  .btn-orange { background: #ffedd5; color: #c2410c; }
  .btn-gray { background: #f1f5f9; color: #475569; }
  .btn-red { background: #fee2e2; color: #b91c1c; }

  .badge { border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red { background: #fee2e2; color: #b91c1c; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-gray { background: #f1f5f9; color: #64748b; }

  .qa-item { margin-bottom: 14px; break-inside: avoid; }
  .qa-q { font-weight: 700; color: #1e40af; font-size: 12.5px; margin-bottom: 4px; }
  .qa-a { color: #475569; font-size: 12px; line-height: 1.7; padding-left: 16px; }

  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin: 10px 0; break-inside: avoid; }
  .card-title { font-size: 12.5px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
</style>
</head>
<body>

<!-- 封面 -->
<div class="cover">
  <div class="cover-icon">⚙️</div>
  <div class="cover-title">核銷系統<br>後台管理者使用說明</div>
  <div class="cover-subtitle">臺中市第2區免費營養午餐核銷系統</div>
  <div class="cover-badge"><span class="cover-dot"></span>115 學年度・承辦學校專用</div>
  <div class="cover-footer">本說明書適用對象：承辦學校系統管理人員</div>
</div>

<!-- 目錄 -->
<div class="toc-page">
  <div class="toc-title">目錄</div>

  <div class="toc-section">基本操作</div>
  <div class="toc-item"><span class="toc-num">一</span><span class="toc-label">登入與後台進入方式</span><span class="toc-dots"></span><span class="toc-page-num">3</span></div>
  <div class="toc-item"><span class="toc-num">二</span><span class="toc-label">系統設定（基本設定 / 期程開放 / 通知信範本 / 學年度管理）</span><span class="toc-dots"></span><span class="toc-page-num">4</span></div>

  <div class="toc-section">學校資料管理</div>
  <div class="toc-item"><span class="toc-num">三</span><span class="toc-label">學校管理（清單 / 帳戶 / 核定金額）</span><span class="toc-dots"></span><span class="toc-page-num">5</span></div>
  <div class="toc-item"><span class="toc-num">四</span><span class="toc-label">帳號管理（各校帳號 / 管理員 / 登入紀錄）</span><span class="toc-dots"></span><span class="toc-page-num">6</span></div>

  <div class="toc-section">核銷作業</div>
  <div class="toc-item"><span class="toc-num">五</span><span class="toc-label">申請審核（整合所有審核作業）</span><span class="toc-dots"></span><span class="toc-page-num">7</span></div>
  <div class="toc-item"><span class="toc-num">六</span><span class="toc-label">總覽：查看各校核銷狀態與匯出報表</span><span class="toc-dots"></span><span class="toc-page-num">8</span></div>

  <div class="toc-section">進階設定</div>
  <div class="toc-item"><span class="toc-num">七</span><span class="toc-label">批次發送催收通知</span><span class="toc-dots"></span><span class="toc-page-num">9</span></div>
  <div class="toc-item"><span class="toc-num">八</span><span class="toc-label">審核通知信範本設定</span><span class="toc-dots"></span><span class="toc-page-num">10</span></div>
  <div class="toc-item"><span class="toc-num">附</span><span class="toc-label">常見問題 Q&amp;A</span><span class="toc-dots"></span><span class="toc-page-num">11</span></div>
</div>

<!-- ══════════════ 第1頁：登入 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">一</div>
    <div class="page-title">登入與後台進入方式</div>
  </div>

  <p class="desc">後台管理功能僅限具管理員權限的帳號使用。請使用學校承辦的 Google 帳號登入系統，登入後依以下步驟進入後台。</p>

  <div class="section-title">進入後台步驟</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">前往系統網址，點選「以 Google 帳號登入」</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">登入後若顯示學校畫面，點選右上角導覽列的「<strong>承辦後台</strong>」按鈕進入管理介面</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">後台介面分為五個頁籤：<strong>總覽、申請審核、帳號管理、學校管理、系統設定</strong></div></div>
  </div>

  <div class="section-title">管理員權限說明</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>操作</th><th>一般帳號</th><th>管理員帳號</th></tr></thead>
      <tbody>
        <tr><td>填寫實支金額、上傳檔案</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td></tr>
        <tr><td>查看各校核銷狀態</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>審核各類申請（上傳、修改）</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>匯入／匯出資料</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>系統設定</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
      </tbody>
    </table>
  </div>

  <div class="tip">💡 如需新增管理員帳號，請至「帳號管理 → 系統管理帳號」，填入對方 Gmail 後點「新增管理員」，對方首次登入後即可使用管理員身份。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 3 頁</span>
  </div>
</div>

<!-- ══════════════ 第2頁：系統設定 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">二</div>
    <div class="page-title">系統設定</div>
  </div>

  <p class="desc">路徑：後台 → <strong>系統設定</strong>。頁面分為四個子分頁，設定完成後點「儲存設定」生效。</p>

  <div class="section-title">① 基本設定</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:28%">欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>系統名稱</strong></td><td>顯示於導覽列、登入頁及瀏覽器標題</td></tr>
        <tr><td><strong>承辦學校</strong></td><td>顯示於登入頁下方；同時作為全區經費收支結算表的抬頭</td></tr>
        <tr><td><strong>計畫名稱</strong></td><td>套用於各校及全區經費收支結算表；系統自動附加「（第X學期）」</td></tr>
        <tr><td><strong>承辦人姓名／職稱／電話</strong></td><td>顯示於登入頁聯絡資訊（格式：姓名職稱　電話）及通知信</td></tr>
        <tr><td><strong>學校端使用說明連結</strong></td><td>學校首頁導覽列顯示「📄 使用說明」下載按鈕</td></tr>
        <tr><td><strong>Google Drive 資料夾 ID</strong></td><td>掃描檔與憑單的雲端儲存位置</td></tr>
        <tr><td><strong>GAS 網址／驗證金鑰</strong></td><td>Google Apps Script 部署網址及密鑰</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">② 期程開放</div>
  <p class="desc">各期程可單獨「開放／關閉」並設定截止日期說明文字。關閉後學校畫面顯示「此階段尚未開放」。</p>

  <div class="section-title">③ 通知信範本</div>
  <p class="desc">包含三種信件範本：催收通知、✅ 審核通過通知、❌ 審核拒絕通知。可自訂主旨與內文，共用一個「儲存設定」按鈕。</p>

  <div class="section-title">④ 學年度管理</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">在「新增學年度」輸入學年（例：116）並點「新增並切換」，即自動切換至新學年度</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">學年度列表顯示所有學年度；點「<strong>切換</strong>」可切換至歷史學年度查閱</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">點「<strong>📥 備份</strong>」可匯出該學年度全部資料（學校清單、帳戶、核銷、帳號）Excel</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text">點「<strong>🗑 清審核</strong>」可清除該學年度所有審核紀錄（含帳戶變更申請），操作前會要求確認</div></div>
  </div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 4 頁</span>
  </div>
</div>

<!-- ══════════════ 第3頁：學校管理 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">三</div>
    <div class="page-title">學校管理</div>
  </div>

  <p class="desc">路徑：後台 → <strong>學校管理</strong>。分為三個子分頁，各自管理不同面向的學校資料。</p>

  <div class="section-title">① 學校清單管理</div>
  <p class="desc">列出所有學校（編號、區別、學校名稱、狀態）。可搜尋快速定位，也可新增學校或啟用／停用個別學校。</p>

  <div class="section-title">② 學校帳戶管理</div>
  <div class="btn-row">
    <span class="btn btn-gray">↓ 下載帳戶範本</span>
    <span class="btn btn-orange">📥 批次匯入帳戶</span>
    <span class="btn btn-green">📊 匯出帳戶彙整表</span>
  </div>
  <p class="desc">下方完整表格顯示各校的銀行名稱、分行名稱、金融機構代碼、帳戶戶名、帳號，每列有「<strong>編輯</strong>」按鈕可逐筆修改。帳戶資料是匯款清冊的基礎，請確認正確。</p>

  <div class="section-title">③ 核定金額管理</div>
  <div class="btn-row">
    <span class="btn btn-gray">↓ 下載金額範本</span>
    <span class="btn btn-blue">📥 批次匯入金額</span>
    <span class="btn btn-blue">✏️ 編輯核定金額</span>
  </div>
  <p class="desc">下方完整金額表格顯示各校兩學期核定金額及全區合計，點「<strong>✏️ 編輯核定金額</strong>」可在表格中逐行修改，儲存後立即生效。</p>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 5 頁</span>
  </div>
</div>

<!-- ══════════════ 第4頁：帳號管理 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">四</div>
    <div class="page-title">帳號管理</div>
  </div>

  <p class="desc">路徑：後台 → <strong>帳號管理</strong>。分為三個子分頁，管理各類帳號資訊與登入記錄。</p>

  <div class="section-title">① 各校綁定帳號（預設）</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>#（編號）</strong></td><td>學校編號，依編號由小到大排序</td></tr>
        <tr><td><strong>綁定學校</strong></td><td>該帳號綁定的學校（區別＋名稱）</td></tr>
        <tr><td><strong>Email</strong></td><td>帳號 Gmail 地址</td></tr>
        <tr><td><strong>承辦人 / 職稱 / 電話</strong></td><td>可點「編輯」修改；此資訊顯示於學校首頁及登入頁</td></tr>
      </tbody>
    </table>
  </div>
  <div class="btn-row">
    <span class="btn btn-blue">編輯</span>
    <span class="btn btn-orange">解綁</span>
    <span class="btn btn-purple">設管理員</span>
    <span class="btn btn-red">刪除</span>
  </div>
  <p class="desc">標題列右側搜尋欄可輸入學校名稱、編號或 Email 即時篩選。若學校承辦人更換，請在此找到對應帳號點「<strong>解綁</strong>」，讓新承辦人重新以自己的 Gmail 登入綁定。</p>

  <div class="section-title">② 系統管理帳號</div>
  <p class="desc">顯示所有管理員帳號列表，可在此撤銷管理員或新增管理員（填入對方 Gmail 即可）。管理員帳號同樣可編輯承辦人姓名、職稱、電話欄位。</p>

  <div class="section-title">③ 登入紀錄</div>
  <p class="desc">記錄每次使用者登入的時間、Email、綁定學校及身份（管理員／學校），最近 200 筆，可依 Email 或學校名稱搜尋。</p>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 6 頁</span>
  </div>
</div>

<!-- ══════════════ 第5頁：申請審核 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">五</div>
    <div class="page-title">申請審核</div>
  </div>

  <p class="desc">路徑：後台 → <strong>申請審核</strong>。整合所有需要後台確認的事項：帳戶變更申請、檔案首次上傳、檔案重新上傳、實支金額修改。頁籤按鈕旁顯示待審件數。</p>

  <div class="section-title">三個子分頁</div>
  <div class="btn-row">
    <span class="btn btn-purple">待審核 <strong>N</strong></span>
    <span class="btn btn-green">已通過</span>
    <span class="btn btn-red">已拒絕</span>
  </div>
  <p class="desc">切換子分頁可檢視不同狀態的申請記錄。</p>

  <div class="section-title">申請類型說明</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>類型</th><th>觸發時機</th><th>核准後</th></tr></thead>
      <tbody>
        <tr><td><strong>帳戶變更申請</strong></td><td>學校提出收款帳戶異動並上傳授權文件</td><td>帳戶資料更新</td></tr>
        <tr><td><strong>首次上傳掃描檔</strong></td><td>學校首次上傳結算表掃描檔</td><td>掃描檔正式生效，學校首頁顯示「✓ 已核准」</td></tr>
        <tr><td><strong>首次上傳送款憑單</strong></td><td>學校首次上傳賸餘款送款憑單</td><td>同上</td></tr>
        <tr><td><strong>重新上傳掃描檔／憑單</strong></td><td>學校申請替換已核准的檔案</td><td>新檔案取代舊檔，舊檔自動刪除</td></tr>
        <tr><td><strong>實支金額修改</strong></td><td>學校申請更正已鎖定的實支金額</td><td>金額更新，E/F 欄位重算，學校可重新下載結算表</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">審核操作流程</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">每張卡片頂端顯示申請類型（藍色 = 首次上傳，紫色 = 其他修改）及學校承辦人資訊</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">檔案類申請：點「<strong>📄 待審檔案</strong>」連結開啟新上傳的檔案確認，必要時可比對「📄 現有檔案」</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">填入<strong>備註</strong>（選填），點「<strong>核准</strong>」或「<strong>拒絕</strong>」完成審核</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text">系統自動寄審核通知信給學校承辦人，並即時更新總覽的檔案狀態</div></div>
  </div>

  <div class="tip">💡 拒絕後，學校上傳的待審檔案會自動刪除，不影響現有已核准的檔案。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 7 頁</span>
  </div>
</div>

<!-- ══════════════ 第6頁：總覽 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">六</div>
    <div class="page-title">總覽：查看各校核銷狀態與匯出報表</div>
  </div>

  <p class="desc">路徑：後台 → <strong>總覽</strong>。系統預設頁面，一次呈現全區學校的核銷進度，並提供多種匯出功能。若有待審件，頁面頂端會顯示提示橫幅，點「申請審核」頁籤處理。</p>

  <div class="section-title">學期切換與篩選</div>
  <p class="desc">左上角點選「第1學期」或「第2學期」切換。工具列提供區別、狀態等篩選條件快速找出未完成的學校。</p>

  <div class="section-title">各校狀態欄位</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>核定金額</strong></td><td>該學期核定金額</td></tr>
        <tr><td><strong>帳號綁定</strong></td><td>是否已有帳號登入並綁定該校</td></tr>
        <tr><td><strong>結算表</strong></td><td>掃描檔狀況；已核准顯示「✓ 開啟」＋「刪除」；待審核顯示「⏳ 首次上傳待審」或「⏳ 重新上傳待審」</td></tr>
        <tr><td><strong>送款憑單</strong></td><td>（第2學期）憑單狀況，同上</td></tr>
        <tr><td><strong>應繳回</strong></td><td>系統計算的應繳回本局金額</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">匯出按鈕（依目前學期套用）</div>
  <div class="btn-row">
    <span class="btn btn-teal">📋 匯款清冊</span>
    <span class="btn btn-purple">💰 賸餘款清冊</span>
    <span class="btn btn-indigo">📑 經費收支結算表</span>
    <span class="btn btn-gray">☁️ 雲端資料夾</span>
  </div>
  <div class="table-wrap" style="margin-top:8px">
    <table>
      <thead><tr><th>按鈕</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td>📋 匯款清冊</td><td>Excel：各校名稱、帳戶資訊、匯款金額（第2學期 = 核定 − 第1學期應繳回）</td></tr>
        <tr><td>💰 賸餘款清冊</td><td>Excel：各校核定、實支、結餘、應繳回金額</td></tr>
        <tr><td>📑 經費收支結算表</td><td>開新分頁列印全區匯總結算表，A-F 欄位自動加總</td></tr>
        <tr><td>☁️ 雲端資料夾</td><td>開啟 Google Drive 掃描檔儲存資料夾</td></tr>
      </tbody>
    </table>
  </div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 8 頁</span>
  </div>
</div>

<!-- ══════════════ 第7頁：催收通知 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">七</div>
    <div class="page-title">批次發送催收通知</div>
  </div>

  <p class="desc">路徑：後台 → 總覽 → 勾選學校 → 點「<strong>📧 催收通知</strong>」。可對尚未完成上傳的學校批次寄發提醒 Email。</p>

  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">在學校清單左側勾選要通知的學校（可透過篩選條件快速選出）</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">點「📧 催收通知（已選 N 校）」按鈕，開啟通知視窗</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">確認或修改主旨與內容，可使用下列變數</div></div>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th>變數</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><code>{schoolName}</code></td><td>學校名稱</td></tr>
        <tr><td><code>{contactName}</code></td><td>承辦人姓名</td></tr>
        <tr><td><code>{contactTitle}</code></td><td>承辦人職稱</td></tr>
        <tr><td><code>{adminName}</code></td><td>承辦學校承辦人姓名</td></tr>
        <tr><td><code>{adminTitle}</code></td><td>承辦學校承辦人職稱</td></tr>
        <tr><td><code>{adminPhone}</code></td><td>承辦學校聯絡電話</td></tr>
      </tbody>
    </table>
  </div>

  <div class="step-item" style="margin-top:8px"><div class="step-num">4</div><div class="step-text">點「<strong>確認寄送</strong>」，系統平行發送給所有選取學校，完成後顯示成功筆數</div></div>

  <div class="tip">💡 信件範本可至「系統設定 → 通知信範本 → 催收通知」預先編輯儲存。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 9 頁</span>
  </div>
</div>

<!-- ══════════════ 第8頁：審核通知信範本 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">八</div>
    <div class="page-title">審核通知信範本設定</div>
  </div>

  <p class="desc">路徑：後台 → <strong>系統設定 → 通知信範本</strong>。可分別設定三種信件的主旨與內文範本，共用「儲存設定」按鈕。</p>

  <div class="table-wrap">
    <table>
      <thead><tr><th>範本</th><th>觸發時機</th></tr></thead>
      <tbody>
        <tr><td><strong>✅ 審核通過通知</strong></td><td>核准任何申請（首次上傳、重新上傳、金額修改）時，自動寄給學校承辦人</td></tr>
        <tr><td><strong>❌ 審核拒絕通知</strong></td><td>拒絕任何申請時，自動寄給學校承辦人</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">可用變數（催收通知與審核通知共用）</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>變數</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><code>{contactName}</code></td><td>學校承辦人姓名</td></tr>
        <tr><td><code>{contactTitle}</code></td><td>學校承辦人職稱</td></tr>
        <tr><td><code>{schoolName}</code></td><td>學校名稱</td></tr>
        <tr><td><code>{semLabel}</code></td><td>學期（例：第1學期）</td></tr>
        <tr><td><code>{typeLabel}</code></td><td>申請類型（例：首次上傳經費收支結算表掃描檔）</td></tr>
        <tr><td><code>{actionNote}</code></td><td>核准後建議操作說明（系統自動帶入）</td></tr>
        <tr><td><code>{adminNote}</code></td><td>管理者填寫的備註說明</td></tr>
        <tr><td><code>{adminName}</code></td><td>承辦學校承辦人姓名</td></tr>
        <tr><td><code>{adminTitle}</code></td><td>承辦學校承辦人職稱</td></tr>
        <tr><td><code>{adminPhone}</code></td><td>承辦學校聯絡電話</td></tr>
      </tbody>
    </table>
  </div>

  <div class="tip">💡 修改範本後點「儲存設定」即生效，後續所有相關通知皆套用新範本。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span>
    <span>第 10 頁</span>
  </div>
</div>

<!-- ══════════════ 附錄：Q&A ══════════════ -->
<div class="page" style="page-break-after:auto;">
  <div class="page-header">
    <div class="page-step">附</div>
    <div class="page-title">常見問題 Q&amp;A</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校反映無法登入或看不到核銷頁面？</div>
    <div class="qa-a">確認學校使用教育局核准的 Gmail 帳號。若帳號正確仍無法進入，至「帳號管理 → 各校綁定帳號」確認該帳號是否已存在，若無需請學校重新登入一次讓系統建立帳號記錄。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校承辦人員更換，如何移交系統操作權限？</div>
    <div class="qa-a">至「帳號管理 → 各校綁定帳號」找到該學校帳號，點「<strong>解綁</strong>」解除舊承辦人的綁定，再由新承辦人以自己的 Gmail 登入並重新選擇綁定學校即可。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校上傳檔案後，總覽顯示「⏳ 首次上傳待審」，需要在哪裡審核？</div>
    <div class="qa-a">所有上傳的檔案（首次上傳或重新上傳）都需由後台審核。請至「<strong>申請審核</strong>」頁籤，在「待審核」子分頁找到對應申請，開啟待審檔案確認後點「核准」即可。核准後總覽的狀態自動更新。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校誤填金額已儲存，如何修正？</div>
    <div class="qa-a">金額儲存後即鎖定，學校需至系統提出「申請修改金額」，後台在「申請審核」頁籤收到申請後審核核准即可，流程完整留有記錄。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">催收通知寄出後沒有反應？</div>
    <div class="qa-a">請確認「系統設定 → 基本設定 → GAS 網址」已正確填入，且 GAS 腳本已部署並與「GAS 驗證金鑰」一致。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">如何切換新學年度作業？</div>
    <div class="qa-a">至「系統設定 → 學年度管理」新增學年度並點「新增並切換」，系統自動切換。接著至「系統設定 → 基本設定」更新計畫名稱，再至「學校管理 → 核定金額管理」批次匯入新學年度核定金額即可。</div>
  </div>

  <div style="margin-top:28px;background:linear-gradient(135deg,#1e40af,#4338ca);border-radius:12px;padding:16px 20px;color:white;">
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">系統維護與支援</div>
    <div style="font-size:12px;opacity:0.9;line-height:1.8;">若遇系統異常或功能問題，請聯絡系統建置人員。<br>日常操作問題可參閱本說明書或洽教育局免費午餐業務承辦人員。</div>
  </div>

  <div style="text-align:center;margin-top:28px;font-size:11px;color:#94a3b8;">
    臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明 · 115 學年度
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

const outPath = path.join(__dirname, '後台管理者使用說明.pdf')
writeFileSync(outPath, pdfBuffer)
console.log('✅ PDF 產生完成：' + outPath)

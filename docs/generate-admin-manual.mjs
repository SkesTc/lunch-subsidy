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

  .page { padding: 32px 54px 36px; page-break-after: always; break-after: page; position: relative; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
  .page-step { background: #1e40af; color: white; width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
  .page-title { font-size: 19px; font-weight: 700; color: #1e40af; }
  .page-footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 7px; }

  .desc { font-size: 12.5px; color: #475569; line-height: 1.8; margin-bottom: 10px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1e40af; margin: 14px 0 7px; }
  .steps { margin: 6px 0 12px; }
  .step-item { display: flex; gap: 10px; margin-bottom: 7px; align-items: flex-start; }
  .step-num { width: 22px; height: 22px; border-radius: 50%; background: #1e40af; color: white; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .step-text { font-size: 12.5px; color: #334155; line-height: 1.7; flex: 1; }
  .step-text strong { color: #1e40af; }
  .tip { background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 8px 0; font-size: 12px; color: #0369a1; line-height: 1.6; break-inside: avoid; }
  .warn { background: #fff7ed; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0; padding: 9px 13px; margin: 8px 0; font-size: 12px; color: #c2410c; line-height: 1.6; break-inside: avoid; }

  .table-wrap { margin: 10px 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; color: #475569; font-weight: 600; padding: 7px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 12px; color: #334155; border-bottom: 1px solid #f1f5f9; line-height: 1.6; }
  tr:last-child td { border-bottom: none; }

  .btn-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
  .btn { border-radius: 8px; padding: 4px 11px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .btn-blue { background: #dbeafe; color: #1d4ed8; }
  .btn-green { background: #dcfce7; color: #15803d; }
  .btn-teal { background: #ccfbf1; color: #0f766e; }
  .btn-purple { background: #ede9fe; color: #7c3aed; }
  .btn-indigo { background: #e0e7ff; color: #4338ca; }
  .btn-orange { background: #ffedd5; color: #c2410c; }
  .btn-amber { background: #fffbeb; color: #b45309; }
  .btn-gray { background: #f1f5f9; color: #475569; }
  .btn-red { background: #fee2e2; color: #b91c1c; }

  .badge { border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-red { background: #fee2e2; color: #b91c1c; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-gray { background: #f1f5f9; color: #64748b; }

  .qa-item { margin-bottom: 12px; break-inside: avoid; }
  .qa-q { font-weight: 700; color: #1e40af; font-size: 12.5px; margin-bottom: 3px; }
  .qa-a { color: #475569; font-size: 12px; line-height: 1.7; padding-left: 14px; }

  .tab-bar { display: flex; gap: 4px; flex-wrap: wrap; margin: 10px 0 14px; }
  .tab { border-radius: 8px; padding: 5px 14px; font-size: 12px; font-weight: 600; }
  .tab-active { background: #1e40af; color: white; }
  .tab-inactive { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .tab-review { background: #7c3aed; color: white; }
  .tab-schools { background: #0891b2; color: white; }
</style>
</head>
<body>

<!-- 封面 -->
<div class="cover">
  <div class="cover-icon">⚙️</div>
  <div class="cover-title">臺中市第2區<br>午餐經費核銷系統</div>
  <div class="cover-subtitle">後台管理者操作使用說明書</div>
  <div class="cover-badge"><span class="cover-dot"></span>115 學年度・承辦學校專用</div>
  <div class="cover-footer">本說明書適用對象：承辦學校系統管理人員</div>
</div>

<!-- 目錄 -->
<div class="toc-page">
  <div class="toc-title">目錄</div>

  <div class="toc-section">基本操作</div>
  <div class="toc-item"><span class="toc-num">一</span><span class="toc-label">登入與後台進入方式</span><span class="toc-dots"></span><span class="toc-page-num">3</span></div>
  <div class="toc-item"><span class="toc-num">二</span><span class="toc-label">後台分頁結構總覽</span><span class="toc-dots"></span><span class="toc-page-num">4</span></div>
  <div class="toc-item"><span class="toc-num">三</span><span class="toc-label">系統設定（基本設定 / 學年度管理）</span><span class="toc-dots"></span><span class="toc-page-num">5</span></div>

  <div class="toc-section">核銷管理</div>
  <div class="toc-item"><span class="toc-num">四</span><span class="toc-label">核銷計畫管理</span><span class="toc-dots"></span><span class="toc-page-num">6</span></div>
  <div class="toc-item"><span class="toc-num">五</span><span class="toc-label">核銷期程設定 / 核定金額管理 / 通知信範本</span><span class="toc-dots"></span><span class="toc-page-num">7</span></div>

  <div class="toc-section">學校資料管理</div>
  <div class="toc-item"><span class="toc-num">六</span><span class="toc-label">學校管理（學校清單 / 帳戶管理）</span><span class="toc-dots"></span><span class="toc-page-num">8</span></div>
  <div class="toc-item"><span class="toc-num">七</span><span class="toc-label">帳號管理（各校帳號 / 管理員 / 模擬身分）</span><span class="toc-dots"></span><span class="toc-page-num">9</span></div>

  <div class="toc-section">核銷作業</div>
  <div class="toc-item"><span class="toc-num">八</span><span class="toc-label">申請審核（整合所有審核作業）</span><span class="toc-dots"></span><span class="toc-page-num">10</span></div>
  <div class="toc-item"><span class="toc-num">九</span><span class="toc-label">總覽：查看各校核銷狀態與匯出報表</span><span class="toc-dots"></span><span class="toc-page-num">11</span></div>
  <div class="toc-item"><span class="toc-num">十</span><span class="toc-label">批次發送催收通知</span><span class="toc-dots"></span><span class="toc-page-num">12</span></div>
  <div class="toc-item"><span class="toc-num">附</span><span class="toc-label">常見問題 Q&amp;A</span><span class="toc-dots"></span><span class="toc-page-num">13</span></div>
</div>

<!-- ══ 第1頁：登入 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">一</div><div class="page-title">登入與後台進入方式</div></div>

  <p class="desc">後台管理功能僅限具管理員權限的帳號使用。請使用學校承辦的 Google 帳號登入系統，登入後依以下步驟進入後台。</p>

  <div class="section-title">進入後台步驟</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">前往系統網址，點選「以 Google 帳號登入」</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">登入後若顯示學校畫面，點選右上角導覽列的「<strong>承辦後台</strong>」按鈕進入管理介面</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">後台介面分為六個主要分頁：<strong>總覽、申請審核、核銷管理、帳號管理、學校管理、系統設定</strong></div></div>
  </div>

  <div class="section-title">管理員帳號說明</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>操作</th><th>一般學校帳號</th><th>管理員帳號</th></tr></thead>
      <tbody>
        <tr><td>填寫實支金額、上傳檔案</td><td style="text-align:center">✓</td><td style="text-align:center">✓</td></tr>
        <tr><td>查看各校核銷狀態</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>審核各類申請（上傳、修改）</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>匯入／匯出資料</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>核銷計畫設定、期程設定</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>模擬學校身分操作</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
        <tr><td>系統設定、學年度管理</td><td style="text-align:center">—</td><td style="text-align:center">✓</td></tr>
      </tbody>
    </table>
  </div>

  <div class="tip">💡 如需新增管理員帳號，請至「帳號管理 → 系統管理帳號」，填入對方 Gmail 後點「新增管理員」。</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 3 頁</span></div>
</div>

<!-- ══ 第2頁：分頁結構總覽 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">二</div><div class="page-title">後台分頁結構總覽</div></div>

  <p class="desc">後台頂部導覽列提供六個主要分頁，各有子分頁。右上角另有「👤 模擬身分」按鈕供測試學校畫面使用。</p>

  <div class="tab-bar">
    <span class="tab tab-active">總覽</span>
    <span class="tab tab-review">申請審核</span>
    <span class="tab tab-schools">核銷管理</span>
    <span class="tab tab-inactive">帳號管理</span>
    <span class="tab tab-inactive">學校管理</span>
    <span class="tab tab-inactive">系統設定</span>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:20%">分頁</th><th style="width:35%">子分頁</th><th>功能說明</th></tr></thead>
      <tbody>
        <tr><td><strong>總覽</strong></td><td>—</td><td>各校核銷進度、計畫資訊卡切換、匯出報表</td></tr>
        <tr><td><strong>申請審核</strong></td><td>待審核 / 已通過 / 已拒絕</td><td>審核帳戶變更、檔案上傳、金額修改</td></tr>
        <tr><td rowspan="4"><strong>核銷管理</strong></td><td>核銷計畫管理</td><td>建立計畫、設定學期、全學年、扣抵規則</td></tr>
        <tr><td>核銷期程設定</td><td>各作業期間開放／關閉、截止日期說明</td></tr>
        <tr><td>核定金額管理</td><td>依計畫批次匯入各校核定金額</td></tr>
        <tr><td>通知信範本</td><td>催收通知、審核通知信主旨與內文</td></tr>
        <tr><td><strong>帳號管理</strong></td><td>各校帳號 / 管理帳號 / 登入紀錄</td><td>帳號查詢、解綁、升降權限</td></tr>
        <tr><td><strong>學校管理</strong></td><td>學校清單 / 帳戶管理</td><td>學校新增停用、銀行帳戶維護</td></tr>
        <tr><td rowspan="2"><strong>系統設定</strong></td><td>基本設定</td><td>系統名稱、承辦人、GAS 連線等</td></tr>
        <tr><td>學年度管理</td><td>切換學年度、備份、清除審核紀錄</td></tr>
      </tbody>
    </table>
  </div>

  <div class="tip">💡 <strong>核銷管理</strong>是新設計的整合分頁，將核銷計畫、期程設定、核定金額、通知信集中管理，進入後台時預設開啟「核銷計畫管理」子分頁。</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 4 頁</span></div>
</div>

<!-- ══ 第3頁：系統設定 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">三</div><div class="page-title">系統設定</div></div>

  <p class="desc">路徑：後台 → <strong>系統設定</strong>。分為「基本設定」與「學年度管理」兩個子分頁。</p>

  <div class="section-title">① 基本設定</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:30%">欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>系統名稱</strong></td><td>顯示於導覽列、登入頁及瀏覽器標題</td></tr>
        <tr><td><strong>承辦學校</strong></td><td>顯示於登入頁下方；同時作為全區收支結算表抬頭</td></tr>
        <tr><td><strong>承辦人姓名／職稱／電話</strong></td><td>顯示於登入頁及審核通知信（{adminName}、{adminPhone} 等變數）</td></tr>
        <tr><td><strong>學校端使用說明連結</strong></td><td>學校端導覽列顯示「📄 使用說明」下載按鈕</td></tr>
        <tr><td><strong>Google Drive 資料夾 ID</strong></td><td>掃描檔與憑單的雲端儲存位置</td></tr>
        <tr><td><strong>GAS 網址／驗證金鑰</strong></td><td>Google Apps Script 部署網址及密鑰（上傳、刪除、寄信共用）</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">② 學年度管理</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text"><strong>新增學年度：</strong>在「新增學年度」欄輸入三位數學年（例：116），點「新增並切換」，系統立即切換至新學年度</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text"><strong>切換學年度：</strong>點列表中「切換」按鈕可切換至任意學年度查閱歷史資料，頁面重新整理後生效</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text"><strong>📥 備份：</strong>匯出該學年度所有資料（學校清單含核定金額、帳戶資料、核銷紀錄、帳號清單）為 Excel 檔；核銷紀錄的結餘款與應繳回金額均為動態計算的正確值</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text"><strong>🗑 清審核：</strong>清除該學年度所有審核紀錄（帳戶變更申請、上傳申請）；操作前需二次確認，不可復原</div></div>
  </div>

  <div class="warn">⚠️ 新學年度開始前，請確認已至「核銷管理 → 核銷計畫管理」建立新學年度的核銷計畫，並在「核定金額管理」批次匯入各校新學年的核定金額。</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 5 頁</span></div>
</div>

<!-- ══ 第4頁：核銷計畫管理 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">四</div><div class="page-title">核銷計畫管理</div></div>

  <p class="desc">路徑：後台 → <strong>核銷管理 → 核銷計畫管理</strong>（預設開啟）。定義本學年度的核銷計畫清單，學校端首頁的金額資訊卡與操作步驟卡均根據此設定動態呈現。</p>

  <div class="section-title">計畫欄位說明</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th style="width:25%">欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>計畫名稱</strong></td><td>顯示於學校端資訊卡標題（例：115學年度公立國中小免費營養午餐計畫）</td></tr>
        <tr><td><strong>短標籤</strong></td><td>顯示於後台計畫卡片與匯出報表欄位（例：午餐）</td></tr>
        <tr><td><strong>計畫類型</strong></td><td>第1學期 / 第2學期 / <strong>全學年</strong>（同一計畫跨兩學期，可設扣抵）</td></tr>
        <tr><td><strong>須繳回賸餘款</strong></td><td>勾選後，學校端顯示「上傳賸餘款送款憑單」步驟</td></tr>
        <tr><td><strong>第1學期結餘扣抵第2學期</strong></td><td>僅全學年計畫可勾選；S1 結餘自動扣減 S2 核定金額，S1 不需繳回</td></tr>
        <tr><td><strong>截止說明文字</strong></td><td>顯示於學校端期程卡的截止日期說明</td></tr>
        <tr><td><strong>排序</strong></td><td>計畫卡片顯示順序（數字越小越前面）</td></tr>
        <tr><td><strong>啟用</strong></td><td>停用後不顯示於學校端（不刪除資料）</td></tr>
      </tbody>
    </table>
  </div>

  <div class="btn-row">
    <span class="btn btn-blue">+ 新增計畫</span>
    <span class="btn btn-gray">📋 建立預設計畫</span>
  </div>

  <div class="section-title">全學年計畫說明</div>
  <p class="desc">選擇「全學年」類型後，一個計畫同時涵蓋第1、第2學期。學校端會呈現兩張期程卡（各自上傳），核定金額管理也會分別顯示 S1 / S2 欄位。</p>
  <p class="desc">若同時勾選「<strong>第1學期結餘扣抵第2學期</strong>」：</p>
  <div class="steps">
    <div class="step-item"><div class="step-num">▸</div><div class="step-text">學校端第2學期資訊卡顯示「扣第1學期結餘 NT$xxx，淨撥款：NT$xxx」</div></div>
    <div class="step-item"><div class="step-num">▸</div><div class="step-text">第1學期不顯示「上傳賸餘款送款憑單」步驟</div></div>
    <div class="step-item"><div class="step-num">▸</div><div class="step-text">後台總覽及匯出報表第1學期也不顯示送款憑單欄</div></div>
  </div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 6 頁</span></div>
</div>

<!-- ══ 第5頁：期程/金額/通知 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">五</div><div class="page-title">核銷期程設定 / 核定金額管理 / 通知信範本</div></div>

  <div class="section-title">① 核銷期程設定</div>
  <p class="desc">路徑：核銷管理 → <strong>核銷期程設定</strong>。各期程可單獨「開放／關閉」並設定截止日期說明文字，關閉後學校端顯示「此階段尚未開放」。</p>
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
  <p class="desc">路徑：核銷管理 → <strong>核定金額管理</strong>。依計畫分組顯示批次匯入區，每個計畫（全學年計畫分第1、第2學期）各有獨立的「↓ 下載範本」與「📥 批次匯入」按鈕。</p>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">點「<strong>↓ 下載範本</strong>」取得含所有學校的 Excel 空白範本</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">在 Excel 填入各校核定金額，儲存後點「<strong>📥 批次匯入</strong>」上傳</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">匯入成功後，下方「<strong>各校核定金額總覽</strong>」即時更新；也可點「✏️ 編輯金額」逐行手動修改</div></div>
  </div>

  <div class="section-title">③ 通知信範本</div>
  <p class="desc">路徑：核銷管理 → <strong>通知信範本</strong>。可分別設定三種信件的主旨與內文：</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>範本</th><th>觸發時機</th></tr></thead>
      <tbody>
        <tr><td><strong>催收通知</strong></td><td>後台手動勾選學校發送</td></tr>
        <tr><td><strong>✅ 審核通過通知</strong></td><td>核准任何申請時自動寄出</td></tr>
        <tr><td><strong>❌ 審核拒絕通知</strong></td><td>拒絕任何申請時自動寄出</td></tr>
      </tbody>
    </table>
  </div>
  <p class="desc" style="margin-top:6px;">可用變數：<code>{schoolName}</code> <code>{contactName}</code> <code>{contactTitle}</code> <code>{semLabel}</code>（含計畫名，例：免費午餐・第1學期）<code>{planLabel}</code>（計畫名）<code>{typeLabel}</code> <code>{actionNote}</code> <code>{adminNote}</code> <code>{adminName}</code> <code>{adminPhone}</code></p>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 7 頁</span></div>
</div>

<!-- ══ 第6頁：學校管理 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">六</div><div class="page-title">學校管理</div></div>

  <p class="desc">路徑：後台 → <strong>學校管理</strong>。分為「學校清單管理」與「學校帳戶管理」兩個子分頁，管理學校基本資料與銀行帳戶。</p>

  <div class="section-title">① 學校清單管理</div>
  <p class="desc">列出所有學校（編號、區別、學校名稱、狀態）。</p>
  <div class="btn-row">
    <span class="btn btn-blue">+ 新增學校</span>
    <span class="btn btn-green">啟用</span>
    <span class="btn btn-gray">停用</span>
  </div>
  <p class="desc">搜尋欄可輸入學校名稱或編號快速定位。停用後學校不再出現於總覽列表，但資料保留。</p>

  <div class="section-title">② 學校帳戶管理</div>
  <div class="btn-row">
    <span class="btn btn-gray">↓ 下載帳戶範本</span>
    <span class="btn btn-orange">📥 批次匯入帳戶</span>
    <span class="btn btn-green">📊 匯出帳戶彙整表</span>
  </div>
  <p class="desc">下方完整表格顯示各校的<strong>銀行名稱、帳戶名稱、局號、帳號</strong>。每列有「<strong>編輯</strong>」按鈕可逐筆修改（編輯欄位：銀行名稱、帳戶名稱、局號、帳號）。</p>
  <p class="desc" style="margin-top:4px;">「↓ 下載範本」下載的 Excel 空白表單欄位為：<strong>編號、區別、學校名稱、銀行名稱、帳戶名稱、局號、帳號</strong>（不含聯絡人欄位）。</p>

  <div class="tip">💡 帳戶資料是「匯款清冊」的基礎，請確認所有在職學校的帳戶資訊已正確填入，尤其在新學年度開始或學校帳戶變更後更新。</div>

  <div class="section-title">帳戶批次匯入說明</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">點「↓ 下載帳戶範本」取得 Excel 格式空白表單，依欄位填入各校帳戶資訊</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">點「📥 批次匯入帳戶」上傳填妥的 Excel，系統以學校編號比對更新</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">匯入結果顯示更新筆數及錯誤訊息（若有找不到學校編號則跳過）</div></div>
  </div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 8 頁</span></div>
</div>

<!-- ══ 第7頁：帳號管理 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">七</div><div class="page-title">帳號管理 & 模擬身分</div></div>

  <p class="desc">路徑：後台 → <strong>帳號管理</strong>。分為三個子分頁，管理各類帳號資訊與登入記錄。</p>

  <div class="section-title">① 各校綁定帳號</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>操作</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>編輯</strong></td><td>修改承辦人姓名、職稱、電話（此資訊顯示於學校首頁及通知信）</td></tr>
        <tr><td><strong>解綁</strong></td><td>解除帳號與學校的綁定關係，讓新承辦人重新以自己的 Gmail 登入綁定</td></tr>
        <tr><td><strong>設管理員</strong></td><td>將該帳號升級為管理員（可同時點解綁將其改為純管理帳號）</td></tr>
        <tr><td><strong>刪除</strong></td><td>從系統移除該帳號記錄（不可復原）</td></tr>
      </tbody>
    </table>
  </div>
  <p class="desc">標題列搜尋欄可輸入學校名稱、編號或 Email 即時篩選。</p>
  <div class="warn">⚠️ 每所學校只能有<strong>一個 Gmail 帳號</strong>進行綁定。承辦人員更換時，請先點「解綁」讓舊帳號釋放，新承辦人再以自己的 Gmail 登入重新綁定。</div>

  <div class="section-title">② 系統管理帳號</div>
  <p class="desc">顯示所有管理員帳號列表，可撤銷管理員或新增管理員（填入對方 Gmail）。管理員帳號亦可編輯承辦人姓名、職稱、電話（顯示於通知信）。</p>

  <div class="section-title">③ 登入紀錄</div>
  <p class="desc">記錄最近 200 筆的登入時間、Email、綁定學校及身份（管理員 / 學校），可依 Email 或學校名稱搜尋。</p>

  <div class="section-title">👤 模擬身分（右上角按鈕）</div>
  <p class="desc">後台右上角提供「<strong>👤 模擬身分</strong>」按鈕，管理員可選擇任一學校，在新分頁以該學校的身份進入學校端畫面，方便確認學校所見的操作流程與資料是否正確。</p>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">點「👤 模擬身分」，搜尋並選擇目標學校</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">新分頁開啟學校端，頂部顯示橘色橫幅「模擬身分中：XXX 學校」</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">確認完畢後點「結束模擬 → 返回後台」即關閉模擬狀態</div></div>
  </div>
  <div class="tip">💡 模擬狀態以 Cookie 儲存，有效期 8 小時；不影響實際資料，關閉分頁後仍可點「結束模擬」清除。</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 9 頁</span></div>
</div>

<!-- ══ 第8頁：申請審核 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">八</div><div class="page-title">申請審核</div></div>

  <p class="desc">路徑：後台 → <strong>申請審核</strong>。整合所有需後台確認的事項。頁籤按鈕旁顯示待審件數，有新申請時總覽頁面頂端也會出現提示橫幅。</p>

  <div class="section-title">狀態子分頁</div>
  <div class="btn-row">
    <span class="btn btn-purple">待審核 <strong>N</strong></span>
    <span class="btn btn-green">已通過</span>
    <span class="btn btn-red">已拒絕</span>
    <span class="btn btn-gray">↻ 重新整理</span>
  </div>

  <div class="section-title">計畫篩選</div>
  <p class="desc">若有設定核銷計畫，子分頁下方顯示計畫篩選按鈕列（含各狀態筆數），可快速過濾特定計畫的申請：</p>
  <div class="btn-row">
    <span class="btn btn-gray">全部計畫 <strong>5</strong></span>
    <span class="btn btn-gray">免費午餐 <strong>3</strong></span>
    <span class="btn btn-gray">課後照顧 <strong>2</strong></span>
  </div>

  <div class="section-title">申請類型說明</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>類型</th><th>觸發時機</th><th>核准後</th></tr></thead>
      <tbody>
        <tr><td><strong>帳戶變更申請</strong></td><td>學校提出收款帳戶異動並上傳授權文件</td><td>帳戶資料更新</td></tr>
        <tr><td><strong>首次上傳掃描檔</strong></td><td>學校首次上傳結算表掃描檔</td><td>掃描檔正式生效，學校首頁顯示 ✓</td></tr>
        <tr><td><strong>首次上傳送款憑單</strong></td><td>學校首次上傳賸餘款送款憑單</td><td>同上</td></tr>
        <tr><td><strong>重新上傳掃描檔／憑單</strong></td><td>學校申請替換已核准的檔案</td><td>新檔取代舊檔，舊檔自動刪除</td></tr>
        <tr><td><strong>實支金額修改</strong></td><td>學校申請更正已鎖定的實支金額</td><td>金額更新，E/F 欄自動重算</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">審核操作流程</div>
  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">每張卡片顯示申請類型（藍色 = 首次上傳，紫色 = 其他）、<strong>計畫名稱・學期</strong>、學校及承辦人資訊</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">點「<strong>📄 待審檔案</strong>」開啟新上傳的檔案確認；重新上傳時可比對「📄 現有檔案」</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">填入備註（選填），點「<strong>核准</strong>」或「<strong>拒絕</strong>」完成審核</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text">系統自動寄審核通知信給學校承辦人，並即時更新總覽的狀態</div></div>
  </div>

  <div class="tip">💡 <strong>拒絕「重新上傳」申請</strong>時，學校提交的新檔案及<strong>原本已核准的舊檔案</strong>都會被刪除，學校需重新從頭上傳。請確認後再執行拒絕。</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 10 頁</span></div>
</div>

<!-- ══ 第9頁：總覽 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">九</div><div class="page-title">總覽：查看各校核銷狀態與匯出報表</div></div>

  <p class="desc">路徑：後台 → <strong>總覽</strong>。系統預設頁面，一次呈現全區學校的核銷進度，並提供多種匯出功能。右上角「↻」可重新整理資料。</p>

  <div class="section-title">計畫資訊卡（有核銷計畫時顯示）</div>
  <p class="desc">頂部顯示各計畫卡片，點擊後切換至該計畫的統計檢視。全學年計畫點選後另有「第1學期 / 第2學期」切換按鈕。每張卡片依所選學期顯示：</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>卡片資訊</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td>結算表上傳 %</td><td>有核定金額的學校中，掃描檔已上傳比例</td></tr>
        <tr><td>實支已填 X/Y</td><td>已填寫實支金額的學校數 / 有核定金額的學校數</td></tr>
        <tr><td>結算表已傳 X/Y</td><td>掃描檔已上傳（待審或核准）的學校數</td></tr>
        <tr><td>送款憑單 X/Y</td><td>（須繳回且非S1扣抵）已上傳送款憑單的學校數</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">各校狀態欄位</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>欄位</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><strong>核定金額</strong></td><td>該學期 / 計畫的核定金額</td></tr>
        <tr><td><strong>帳號綁定</strong></td><td>是否已有帳號登入並綁定該校</td></tr>
        <tr><td><strong>實支金額</strong></td><td>學校已填的實支總額（點即可開啟填報頁面）</td></tr>
        <tr><td><strong>結算表</strong></td><td>已核准顯示「✓ 開啟」＋「刪除」；待審顯示「⏳ 待審」</td></tr>
        <tr><td><strong>送款憑單</strong></td><td>同上（僅顯示需繳回且有動態結餘的學校）</td></tr>
        <tr><td><strong>應繳回</strong></td><td>動態計算的應繳回本局金額</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section-title">匯出按鈕（依所選計畫／學期套用）</div>
  <div class="btn-row">
    <span class="btn btn-teal">📋 匯款清冊 ▾</span>
    <span class="btn btn-purple">💰 賸餘款清冊</span>
    <span class="btn btn-indigo">📑 經費收支結算表</span>
    <span class="btn btn-gray">☁️ 雲端資料夾</span>
  </div>
  <p class="desc">各報表均依目前<strong>選取的計畫與學期</strong>匯出，包含對應的核定金額與動態計算的結餘、應繳回金額。</p>
  <div class="tip">💡 <strong>匯款清冊</strong>按鈕點擊後展開下拉選單，可選擇匯出範圍：<br>
  ・<strong>全部</strong> — 匯出所有學校<br>
  ・<strong>臺灣銀行</strong> — 只匯出銀行名稱含「臺灣銀行」的學校<br>
  ・<strong>非臺灣銀行</strong> — 匯出其他銀行的學校<br>
  匯出欄位：編號、區別、學校名稱、銀行名稱、帳戶名稱、局號、帳號、匯款金額</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 11 頁</span></div>
</div>

<!-- ══ 第10頁：催收通知 ══ -->
<div class="page">
  <div class="page-header"><div class="page-step">十</div><div class="page-title">批次發送催收通知</div></div>

  <p class="desc">路徑：後台 → 總覽 → 勾選學校 → 點「<strong>📧 催收通知</strong>」。可對尚未完成上傳的學校批次寄發提醒 Email。</p>

  <div class="steps">
    <div class="step-item"><div class="step-num">1</div><div class="step-text">在學校清單左側勾選要通知的學校（可先篩選「結算表未上傳」等條件再全選）</div></div>
    <div class="step-item"><div class="step-num">2</div><div class="step-text">點「📧 催收通知（已選 N 校）」按鈕開啟通知視窗</div></div>
    <div class="step-item"><div class="step-num">3</div><div class="step-text">確認或修改主旨與內容，可使用系統變數（範本可在「核銷管理 → 通知信範本」預先設定）</div></div>
    <div class="step-item"><div class="step-num">4</div><div class="step-text">點「<strong>確認寄送</strong>」，系統平行發送；完成後顯示成功筆數</div></div>
  </div>

  <div class="section-title">催收通知可用變數</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>變數</th><th>說明</th></tr></thead>
      <tbody>
        <tr><td><code>{schoolName}</code></td><td>學校名稱</td></tr>
        <tr><td><code>{contactName}</code></td><td>學校承辦人姓名</td></tr>
        <tr><td><code>{contactTitle}</code></td><td>學校承辦人職稱</td></tr>
        <tr><td><code>{adminName}</code></td><td>承辦學校承辦人姓名</td></tr>
        <tr><td><code>{adminTitle}</code></td><td>承辦學校承辦人職稱</td></tr>
        <tr><td><code>{adminPhone}</code></td><td>承辦學校聯絡電話</td></tr>
        <tr><td><code>{hostSchool}</code></td><td>承辦學校名稱</td></tr>
      </tbody>
    </table>
  </div>

  <div class="tip">💡 若勾選全區學校後點催收通知，系統只寄給有帳號綁定（已有學校承辦人 Email）的學校，未綁定的學校自動略過。</div>

  <div class="page-footer"><span>臺中市第2區免費營養午餐核銷系統 · 後台管理者使用說明</span><span>第 12 頁</span></div>
</div>

<!-- ══ 附錄：Q&A ══ -->
<div class="page" style="page-break-after:auto;">
  <div class="page-header"><div class="page-step">附</div><div class="page-title">常見問題 Q&amp;A</div></div>

  <div class="qa-item">
    <div class="qa-q">學校反映無法登入或看不到核銷頁面？</div>
    <div class="qa-a">確認學校使用教育局核准的 Gmail 帳號。若帳號正確仍無法進入，至「帳號管理 → 各校綁定帳號」確認帳號是否存在，若無請學校重新登入讓系統建立帳號記錄後再確認綁定狀態。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校承辦人更換，如何移交系統操作？</div>
    <div class="qa-a">至「帳號管理 → 各校綁定帳號」找到該學校帳號，點「<strong>解綁</strong>」解除舊承辦人的綁定，新承辦人以自己的 Gmail 登入並選擇綁定學校即可。移交後請提醒新承辦人至首頁更新聯絡人資訊。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校上傳後總覽顯示「⏳ 待審」，需要在哪裡審核？</div>
    <div class="qa-a">至「<strong>申請審核</strong>」頁籤的「待審核」子分頁，找到對應申請，開啟待審檔案確認後點「核准」。核准後總覽狀態即時更新，並自動寄審核通知信。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">拒絕「重新上傳」後，學校說舊檔案也消失了？</div>
    <div class="qa-a">這是系統設計行為：拒絕重新上傳申請時，待審的新檔案與原本已核准的舊檔案都會被刪除，學校需重新提交原始文件。若只是不接受新檔但要保留舊檔，請勿點「拒絕」，改以備註方式回覆後仍點「核准」，或直接聯絡學校。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">學校誤填金額已儲存，如何修正？</div>
    <div class="qa-a">金額儲存後即鎖定。請請學校至系統提出「申請修改金額」，後台在「申請審核」頁籤審核核准後，金額自動更新，學校重新下載結算表即可。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">新增核銷計畫後，學校端沒有顯示？</div>
    <div class="qa-a">請確認：① 計畫是否已「啟用」；② 「核定金額管理」是否已匯入該學校的核定金額（系統只顯示有核定金額的計畫）；③ 「核銷期程設定」對應學期是否已開放。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">如何切換新學年度？</div>
    <div class="qa-a">至「系統設定 → 學年度管理」新增學年度並點「新增並切換」。接著至「核銷管理 → 核銷計畫管理」建立新年度計畫，再至「核定金額管理」批次匯入各校核定金額，並在「核銷期程設定」設定各期程開放時間。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">催收通知寄出後沒有反應？</div>
    <div class="qa-a">請確認「系統設定 → 基本設定 → GAS 網址」已正確填入，且 GAS 腳本已部署並與「GAS 驗證金鑰」一致。確認後可在「核銷管理 → 基本設定」重新測試。</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">如何確認學校所看到的畫面是否正確？</div>
    <div class="qa-a">點後台右上角「<strong>👤 模擬身分</strong>」，選擇目標學校，系統在新分頁以該校身份開啟學校端，可完整測試該校的畫面與操作流程。確認完畢後點橘色橫幅的「結束模擬」即可返回後台。</div>
  </div>

  <div style="margin-top:24px;background:linear-gradient(135deg,#1e40af,#4338ca);border-radius:12px;padding:16px 20px;color:white;">
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">系統維護與支援</div>
    <div style="font-size:12px;opacity:0.9;line-height:1.8;">若遇系統異常或功能問題，請聯絡系統建置人員。<br>日常操作問題可參閱本說明書或洽教育局免費午餐業務承辦人員。</div>
  </div>

  <div style="text-align:center;margin-top:24px;font-size:11px;color:#94a3b8;">
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

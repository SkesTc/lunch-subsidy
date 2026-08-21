import puppeteer from '/opt/homebrew/lib/node_modules/puppeteer/lib/puppeteer/puppeteer.js'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>學校端使用說明</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
  /* 所有頁面上下各留 10mm，避免列印時頁邊裁切內容 */
  @page { margin: 10mm 0; }
  /* 封面與目錄為全版面設計，不需上下邊距 */
  @page :first { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans TC', 'PingFang TC', sans-serif; font-size: 13px; color: #1e293b; background: white; }

  /* ── 封面 ── */
  .cover {
    width: 100%; height: 100vh;
    background: linear-gradient(160deg, #1e40af 0%, #3730a3 50%, #6d28d9 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; text-align: center; padding: 60px; position: relative;
    page-break-after: always; break-after: page;
  }
  .cover-icon { font-size: 80px; margin-bottom: 32px; }
  .cover-title { font-size: 36px; font-weight: 700; line-height: 1.3; margin-bottom: 16px; }
  .cover-subtitle { font-size: 18px; font-weight: 400; opacity: 0.85; margin-bottom: 40px; }
  .cover-badge {
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
    border-radius: 99px; padding: 8px 24px; font-size: 14px; display: inline-flex; align-items: center; gap: 8px;
  }
  .cover-dot { width: 8px; height: 8px; border-radius: 50%; background: #86efac; display: inline-block; }
  .cover-footer { position: absolute; bottom: 48px; font-size: 12px; opacity: 0.6; }

  /* ── 目錄 ── */
  .toc-page { padding: 48px 64px; page-break-after: always; break-after: page; }
  .toc-title { font-size: 28px; font-weight: 700; color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 32px; }
  .toc-item { display: flex; align-items: baseline; margin-bottom: 14px; font-size: 14px; }
  .toc-num { color: #1e40af; font-weight: 700; width: 32px; flex-shrink: 0; }
  .toc-label { flex: 1; color: #334155; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 8px; }
  .toc-page-num { color: #64748b; font-size: 12px; }
  .toc-section { font-size: 16px; font-weight: 700; color: #1e40af; margin: 24px 0 12px; }

  /* ── 一般頁面 ── */
  .page { padding: 26px 56px 28px; page-break-after: always; break-after: page; position: relative; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #e2e8f0; }
  .page-step { background: #1e40af; color: white; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; }
  .page-title { font-size: 20px; font-weight: 700; color: #1e40af; }
  /* CSS counter：封面=1, 目錄=2, 第一個 .page 從 3 開始 */
  body { counter-reset: pg 2; }
  .page { counter-increment: pg; }
  .auto-pg::before { content: counter(pg); }
  .page-footer { margin-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px; }

  /* ── 說明文字 ── */
  .desc { font-size: 12.5px; color: #475569; line-height: 1.8; margin-bottom: 14px; }
  .steps { margin: 10px 0 16px; }
  .step-item { display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start; }
  .step-num { width: 24px; height: 24px; border-radius: 50%; background: #1e40af; color: white; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .step-text { font-size: 12.5px; color: #334155; line-height: 1.7; flex: 1; }
  .step-text strong { color: #1e40af; }
  .tip { background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 12px 0; font-size: 12px; color: #0369a1; line-height: 1.6; break-inside: avoid; page-break-inside: avoid; }
  .warn { background: #fff7ed; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 12px 0; font-size: 12px; color: #c2410c; line-height: 1.6; break-inside: avoid; page-break-inside: avoid; }

  /* ── 截圖框 ── */
  .screenshot-wrap { margin: 10px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12); border: 1px solid #e2e8f0; break-inside: avoid; page-break-inside: avoid; }
  .screenshot-caption { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 7px 14px; font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 6px; }
  .screenshot-caption::before { content: '▲'; font-size: 9px; }

  /* ── 模擬畫面 Navbar ── */
  .sim-navbar {
    background: #1e3a5f; color: white; padding: 8px 16px;
    display: flex; align-items: center; justify-content: space-between; font-size: 11px;
  }
  .sim-navbar-left { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 13px; }
  .sim-navbar-right { display: flex; align-items: center; gap: 12px; font-size: 11px; color: #93c5fd; }
  .sim-year-badge { background: rgba(255,255,255,0.15); border-radius: 99px; padding: 2px 10px; font-size: 11px; color: #bfdbfe; }

  /* ── 登入頁模擬 ── */
  .sim-login { background: #f1f5f9; padding: 12px; display: flex; flex-direction: column; align-items: center; }
  .sim-login-card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.10); width: 280px; border: 1px solid #e2e8f0; }
  .sim-login-top { background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 20px 20px 18px; text-align: center; color: white; }
  .sim-login-icon { width: 42px; height: 42px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 12px; }
  .sim-login-title { font-size: 13px; font-weight: 700; line-height: 1.4; }
  .sim-login-year { margin-top: 10px; background: rgba(255,255,255,0.2); border-radius: 99px; padding: 3px 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 10px; }
  .sim-login-dot { width: 6px; height: 6px; border-radius: 50%; background: #86efac; }
  .sim-login-body { padding: 16px; }
  .sim-login-btn { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: #334155; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .sim-login-hint { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 10px; }
  .sim-login-footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 10px; }

  /* ── 首頁模擬 ── */
  .sim-page { background: #f8fafc; padding: 8px; }
  .sim-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 8px 10px; margin-bottom: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .sim-school-name { font-size: 15px; font-weight: 700; color: #1e293b; }
  .sim-school-meta { font-size: 10px; color: #64748b; margin-bottom: 2px; }
  .sim-contact { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .sim-amount-total { font-size: 10px; color: #64748b; }
  .sim-amount-big { font-size: 16px; font-weight: 700; color: #1d4ed8; }
  .sim-school-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .sim-btn-row { display: flex; gap: 6px; margin-top: 4px; }
  .sim-btn-sm { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 3px 8px; font-size: 10px; color: #475569; }
  .sim-sem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
  .sim-sem-card { border-radius: 10px; padding: 7px 8px; }
  .sim-sem-card.blue { background: #eff6ff; }
  .sim-sem-card.indigo { background: #eef2ff; }
  .sim-sem-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .sim-sem-label.blue { color: #2563eb; }
  .sim-sem-label.indigo { color: #4f46e5; }
  .sim-sem-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
  .sim-sem-key { color: #64748b; }
  .sim-sem-val { font-weight: 600; }
  .sim-sem-val.blue { color: #1d4ed8; }
  .sim-sem-val.indigo { color: #4338ca; }

  /* ── 期間卡 ── */
  .sim-period { margin-bottom: 6px; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
  .sim-period-header { padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; color: white; font-size: 11px; font-weight: 700; }
  .sim-period-header.blue { background: #2563eb; }
  .sim-period-header.sky { background: #0ea5e9; }
  .sim-period-header.indigo { background: #4f46e5; }
  .sim-period-header.gray { background: #9ca3af; }
  .sim-period-deadline { font-size: 10px; font-weight: 400; opacity: 0.85; }
  .sim-period-body { background: white; padding: 8px; }
  .sim-step-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border: 1px solid #f1f5f9; border-radius: 8px; margin-bottom: 4px; }
  .sim-step-circle { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .sim-step-circle.done { background: #22c55e; color: white; }
  .sim-step-circle.pending { background: #fbbf24; color: white; }
  .sim-step-circle.todo { background: #e2e8f0; color: #64748b; }
  .sim-step-circle.opt { background: #dbeafe; color: #2563eb; }
  .sim-step-info { flex: 1; }
  .sim-step-title { font-size: 11px; font-weight: 600; color: #1e293b; }
  .sim-step-desc { font-size: 10px; color: #94a3b8; margin-top: 1px; }
  .sim-step-arrow { color: #94a3b8; font-size: 12px; }
  .sim-disabled-msg { text-align: center; color: #9ca3af; font-size: 11px; padding: 8px; }

  /* ── 標注圖層 ── */
  .annotate { position: relative; }
  .callout { position: absolute; background: #ef4444; color: white; border-radius: 99px; padding: 3px 10px; font-size: 10px; font-weight: 700; white-space: nowrap; z-index: 10; }
  .callout::after { content: ''; position: absolute; width: 8px; height: 8px; background: #ef4444; }

  /* ── 表格 ── */
  table.guide { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11.5px; break-inside: avoid; page-break-inside: avoid; }
  table.guide th { background: #1e40af; color: white; padding: 5px 12px; text-align: left; font-weight: 600; }
  table.guide td { padding: 5px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  table.guide tr:nth-child(even) td { background: #f8fafc; }

  /* ── 表單模擬 ── */
  .sim-form { padding: 10px 12px; background: white; }
  .sim-form-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .sim-back { font-size: 11px; color: #64748b; margin-bottom: 8px; }
  .sim-field { margin-bottom: 7px; }
  .sim-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
  .sim-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 10px; font-size: 12px; color: #334155; width: 100%; background: #f8fafc; }
  .sim-input.focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 3px #dbeafe; }
  .sim-submit { background: #2563eb; color: white; border: none; border-radius: 10px; padding: 8px 20px; font-size: 13px; font-weight: 600; width: 100%; margin-top: 4px; }
  .sim-submit.green { background: #16a34a; }
  .sim-section { font-size: 12px; font-weight: 700; color: #1e293b; margin: 10px 0 7px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .sim-row { display: flex; gap: 8px; }
  .sim-row .sim-field { flex: 1; }
  .sim-amount-display { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px; margin: 8px 0; }
  .sim-amount-display-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 4px; }
  .sim-amount-display-row:last-child { margin-bottom: 0; font-weight: 700; font-size: 14px; }
  .sim-amount-display-key { color: #16a34a; }
  .sim-amount-display-val { color: #15803d; }
  .sim-file-zone { border: 2px dashed #cbd5e1; border-radius: 10px; padding: 10px; text-align: center; margin: 6px 0; color: #94a3b8; font-size: 12px; }
  .sim-file-zone-icon { font-size: 18px; margin-bottom: 4px; }
  .sim-uploaded { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; margin: 12px 0; }
  .sim-uploaded-icon { font-size: 20px; }
  .sim-uploaded-info { flex: 1; }
  .sim-uploaded-name { font-size: 12px; font-weight: 600; color: #166534; }
  .sim-uploaded-time { font-size: 10px; color: #4ade80; }

  /* ── 狀態圖示說明 ── */
  .badge-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .badge-icon { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .badge-desc { font-size: 13px; color: #334155; }

  /* ── Q&A ── */
  .qa-item { margin-bottom: 20px; }
  .qa-q { font-weight: 700; color: #1e40af; font-size: 13px; margin-bottom: 6px; }
  .qa-q::before { content: 'Q'; background: #1e40af; color: white; border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-right: 8px; }
  .qa-a { font-size: 13px; color: #475569; line-height: 1.8; padding-left: 26px; }
  .qa-a::before { content: 'A'; background: #22c55e; color: white; border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-right: 8px; }

  @media print {
    .page { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- ══════════════ 封面 ══════════════ -->
<div class="cover">
  <div class="cover-icon">🍱</div>
  <div class="cover-title">臺中市第2區<br>午餐經費核銷系統</div>
  <div class="cover-subtitle">學校端 操作使用說明書</div>
  <div class="cover-badge">
    <span class="cover-dot"></span>
    115 學年度
  </div>
  <div class="cover-footer">適用對象：各校午餐核銷承辦人員</div>
</div>

<!-- ══════════════ 目錄 ══════════════ -->
<div class="toc-page">
  <div class="toc-title">📋 目錄</div>

  <div class="toc-section">系統操作流程</div>
  <div class="toc-item"><span class="toc-num">一</span><span class="toc-label">登入系統</span><span class="toc-dots"></span><span class="toc-page-num">3</span></div>
  <div class="toc-item"><span class="toc-num">二</span><span class="toc-label">首頁總覽與各功能說明</span><span class="toc-dots"></span><span class="toc-page-num">4</span></div>
  <div class="toc-item"><span class="toc-num">三</span><span class="toc-label">更新承辦人聯絡資訊</span><span class="toc-dots"></span><span class="toc-page-num">5</span></div>
  <div class="toc-item"><span class="toc-num">四</span><span class="toc-label">帳戶資訊變更申請（選填）</span><span class="toc-dots"></span><span class="toc-page-num">6</span></div>
  <div class="toc-item"><span class="toc-num">五</span><span class="toc-label">填寫實支金額並下載結算表</span><span class="toc-dots"></span><span class="toc-page-num">7</span></div>
  <div class="toc-item"><span class="toc-num">六</span><span class="toc-label">上傳收支結算表掃描檔</span><span class="toc-dots"></span><span class="toc-page-num">8</span></div>
  <div class="toc-item"><span class="toc-num">七</span><span class="toc-label">上傳賸餘款送款憑單（第2學期）</span><span class="toc-dots"></span><span class="toc-page-num">9</span></div>

  <div class="toc-section" style="margin-top:28px;">附錄</div>
  <div class="toc-item"><span class="toc-num">八</span><span class="toc-label">狀態圖示說明</span><span class="toc-dots"></span><span class="toc-page-num">10</span></div>
  <div class="toc-item"><span class="toc-num">九</span><span class="toc-label">常見問題 Q&A</span><span class="toc-dots"></span><span class="toc-page-num">10</span></div>
</div>

<!-- ══════════════ 第1頁：登入 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">一</div>
    <div class="page-title">登入系統</div>
  </div>

  <p class="desc">請使用學校或教育局核准的 Gmail 帳號登入系統。首次登入後需要綁定所屬學校。</p>

  <div class="steps">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-text">開啟瀏覽器，輸入系統網址：<strong>lunch.skes.tc.edu.tw</strong></div>
    </div>
    <div class="step-item">
      <div class="step-num">2</div>
      <div class="step-text">點選「<strong>以 Google 帳號登入</strong>」按鈕</div>
    </div>
    <div class="step-item">
      <div class="step-num">3</div>
      <div class="step-text">選擇學校核准的 Gmail 帳號完成授權</div>
    </div>
    <div class="step-item">
      <div class="step-num">4</div>
      <div class="step-text">首次登入若跳出「尚未綁定學校」提示，請在下拉選單中選擇您的學校後儲存</div>
    </div>
  </div>

  <div class="screenshot-wrap">
    <!-- 登入頁模擬 -->
    <div class="sim-login">
      <div class="sim-login-card">
        <div class="sim-login-top">
          <div class="sim-login-icon">🍱</div>
          <div class="sim-login-title">臺中市第2區<br>免費營養午餐核銷系統</div>
          <div class="sim-login-year">
            <span class="sim-login-dot"></span>
            115 學年度
          </div>
        </div>
        <div class="sim-login-body">
          <div class="sim-login-btn">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            以 Google 帳號登入
          </div>
          <div class="sim-login-hint">請使用學校或教育局核准之 Gmail 帳號</div>
        </div>
      </div>
      <div class="sim-login-footer">承辦學校：（依系統設定顯示）</div>
    </div>
    <div class="screenshot-caption">▸ 系統登入畫面 — 點選「以 Google 帳號登入」即可進入</div>
  </div>

  <div class="warn">⚠️ 若帳號綁定錯誤，可在首頁右上角點選「<strong>重新綁定 Gmail</strong>」重新選擇學校。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第2頁：首頁總覽 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">二</div>
    <div class="page-title">首頁總覽與各功能說明</div>
  </div>

  <p class="desc">登入後進入學校首頁，頁面分為審核結果通知（有新通知時才顯示）、學校資訊卡與各作業期間卡。各期間只有承辦端開放後才能操作。</p>
  <div class="tip">📬 <strong>審核結果通知說明：</strong>當承辦學校審核您的申請後，首頁頂端會出現綠色（✅ 核准）或紅色（❌ 退回）通知橫幅。點右側「✕」可關閉通知，關閉後不再顯示。通知僅顯示 <strong>7 天內</strong>的記錄；若需查閱所有歷史審核結果，請點頁面右下角「<strong>📋 審核訊息紀錄</strong>」按鈕。</div>

  <div class="screenshot-wrap">
    <!-- 首頁模擬 -->
    <div>
      <div class="sim-navbar">
        <div class="sim-navbar-left">
          🍱 臺中市第2區免費營養午餐核銷系統
          <span class="sim-year-badge">115 學年度</span>
        </div>
        <div class="sim-navbar-right">
          神岡區社口國民小學 &nbsp;·&nbsp; xxxxxx@skes.tc.edu.tw &nbsp;
          <span style="background:rgba(255,255,255,0.15);border-radius:6px;padding:2px 8px;color:white;font-size:10px;">📄 使用說明</span>
          <span style="background:rgba(255,255,255,0.15);border-radius:6px;padding:2px 8px;color:white;font-size:10px;">登出</span>
        </div>
      </div>
      <div class="sim-page">
        <!-- 審核結果通知（只示範一則） -->
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:flex-start;gap:6px;">
          <span style="font-size:13px;flex-shrink:0;">✅</span>
          <div style="flex:1;">
            <div style="font-size:10px;font-weight:700;color:#15803d;">第1學期「首次上傳經費收支結算表掃描檔」申請已核准通過</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:1px;">審核時間：06/21 14:30</div>
          </div>
          <span style="font-size:9px;color:#86efac;flex-shrink:0;">✕</span>
        </div>
        <!-- 學校資訊卡 -->
        <div class="sim-card">
          <div class="sim-school-top">
            <div>
              <div class="sim-school-meta">115 學年度・神岡區・編號 25</div>
              <div class="sim-school-name">神岡區社口國民小學</div>
              <div class="sim-contact">承辦人：王小明（組長）　0912-345-678</div>
            </div>
            <div style="text-align:right">
              <div class="sim-amount-total">核定總金額</div>
              <div class="sim-amount-big">NT$ 13,639,680</div>
              <div class="sim-btn-row" style="justify-content:flex-end">
                <div class="sim-btn-sm">✏ 編輯聯絡人</div>
                <div class="sim-btn-sm">重新綁定 Gmail</div>
              </div>
            </div>
          </div>
          <div class="sim-sem-grid">
            <div class="sim-sem-card blue">
              <div class="sim-sem-label blue">第1學期</div>
              <div class="sim-sem-row"><span class="sim-sem-key">核定金額</span><span class="sim-sem-val blue">NT$ 6,890,880</span></div>
              <div class="sim-sem-row"><span class="sim-sem-key">實支金額</span><span class="sim-sem-val" style="color:#1e293b;">NT$ 6,840,000</span></div>
              <div class="sim-sem-row"><span class="sim-sem-key">結餘款</span><span class="sim-sem-val" style="color:#ea580c;">NT$ 50,880</span></div>
            </div>
            <div class="sim-sem-card indigo">
              <div class="sim-sem-label indigo">第2學期</div>
              <div class="sim-sem-row"><span class="sim-sem-key">核定金額</span><span class="sim-sem-val indigo">NT$ 6,748,800</span></div>
              <div style="font-size:10px;background:#fff7ed;border-radius:6px;padding:6px;color:#c2410c;">扣第1學期結餘 NT$ 50,880<br><strong>淨撥款：NT$ 6,697,920</strong></div>
              <div class="sim-sem-row" style="margin-top:4px;"><span class="sim-sem-key">實支金額</span><span class="sim-sem-val" style="color:#1e293b;">NT$ 6,700,000</span></div>
              <div class="sim-sem-row"><span class="sim-sem-key">結餘款</span><span class="sim-sem-val" style="color:#ea580c;">NT$ 48,800</span></div>
              <div class="sim-sem-row"><span class="sim-sem-key">應繳回</span><span class="sim-sem-val" style="color:#dc2626;">NT$ 48,800</span></div>
            </div>
          </div>
        </div>
        <!-- 期間卡 -->
        <div class="sim-period">
          <div class="sim-period-header blue">
            <span>第1學期初</span>
            <span class="sim-period-deadline">2026-06-30前</span>
          </div>
          <div class="sim-period-body">
            <div class="sim-step-row">
              <div class="sim-step-circle opt">✎</div>
              <div class="sim-step-info">
                <div class="sim-step-title">帳戶資訊變更申請</div>
                <div class="sim-step-desc">如需修改匯款帳戶資訊，請點此送出申請</div>
              </div>
              <span class="sim-step-arrow">→</span>
            </div>
          </div>
        </div>
        <div class="sim-period">
          <div class="sim-period-header sky">
            <span>第1學期末</span>
            <span class="sim-period-deadline">2027-02-15</span>
          </div>
          <div class="sim-period-body">
            <div class="sim-step-row">
              <div class="sim-step-circle done">✓</div>
              <div class="sim-step-info">
                <div class="sim-step-title">填寫實支金額</div>
                <div class="sim-step-desc">已下載，請列印蓋章後上傳</div>
              </div>
              <span class="sim-step-arrow">→</span>
            </div>
            <div class="sim-step-row">
              <div class="sim-step-circle pending">⏳</div>
              <div class="sim-step-info">
                <div class="sim-step-title">上傳收支結算表掃描檔</div>
                <div class="sim-step-desc">待審核中，請靜候通知</div>
              </div>
              <span class="sim-step-arrow">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="screenshot-caption">▸ 學校首頁 — 顯示審核結果通知（✅核准）、學校資訊卡、各學期作業進度</div>
  </div>

  <table class="guide">
    <tr><th>區塊</th><th>說明</th></tr>
    <tr><td>學校資訊卡</td><td>顯示學年度、核定金額、各學期實支與結餘摘要，以及承辦人聯絡資訊</td></tr>
    <tr><td>第1學期初</td><td>選填 — 帳戶資訊有異動時才需操作</td></tr>
    <tr><td>第1學期末</td><td>必填 — 填寫實支金額、上傳結算表掃描檔</td></tr>
    <tr><td>第2學期末</td><td>必填 — 填寫實支金額、上傳結算表掃描檔、上傳賸餘款送款憑單</td></tr>
  </table>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第3頁：聯絡人 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">三</div>
    <div class="page-title">更新承辦人聯絡資訊</div>
  </div>

  <p class="desc">首頁右上角有「<strong>編輯聯絡人</strong>」按鈕，可填寫或更新承辦人的姓名、職稱與電話，供承辦學校聯絡使用。</p>

  <div class="steps">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-text">在首頁學校資訊卡右側，點選「<strong>✏ 編輯聯絡人</strong>」</div>
    </div>
    <div class="step-item">
      <div class="step-num">2</div>
      <div class="step-text">在彈出的表單中填入：<strong>姓名</strong>、<strong>職稱</strong>、<strong>聯絡電話</strong></div>
    </div>
    <div class="step-item">
      <div class="step-num">3</div>
      <div class="step-text">點「<strong>儲存</strong>」完成，資訊立即更新</div>
    </div>
  </div>

  <div class="screenshot-wrap">
    <div style="background:#f8fafc; padding:16px; display:flex; justify-content:center;">
      <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:18px;width:300px;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px;">編輯聯絡人資訊</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">此資訊將顯示在後台供承辦學校聯絡</div>
        <div class="sim-field">
          <div class="sim-label">姓名</div>
          <div class="sim-input">王小明</div>
        </div>
        <div class="sim-field">
          <div class="sim-label">職稱</div>
          <div class="sim-input">組長</div>
        </div>
        <div class="sim-field">
          <div class="sim-label">聯絡電話</div>
          <div class="sim-input focus">0912-345-678</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:7px;text-align:center;font-size:12px;color:#64748b;">取消</div>
          <div style="flex:1;background:#2563eb;border-radius:8px;padding:7px;text-align:center;font-size:12px;color:white;font-weight:600;">儲存</div>
        </div>
      </div>
    </div>
    <div class="screenshot-caption">▸ 編輯聯絡人資訊對話框 — 填入姓名、職稱、電話後點儲存</div>
  </div>

  <div class="tip">💡 建議在首次登入後，立即填寫聯絡人資訊，方便承辦學校主動聯繫。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第4頁：帳戶變更 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">四</div>
    <div class="page-title">帳戶資訊變更申請（選填）</div>
  </div>

  <p class="desc">若本學年度的匯款帳戶資訊需要變更，請在「第1學期初」期間送出申請。若帳戶無異動，此步驟可略過。</p>

  <div class="steps">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-text">點選首頁「第1學期初」→「<strong>帳戶資訊變更申請</strong>」</div>
    </div>
    <div class="step-item">
      <div class="step-num">2</div>
      <div class="step-text">頁面上方會顯示目前登記的帳戶資訊，確認後填入新的帳戶資料</div>
    </div>
    <div class="step-item">
      <div class="step-num">3</div>
      <div class="step-text">點「<strong>選擇檔案</strong>」上傳<strong>存摺封面或帳戶資訊圖檔</strong>（JPG / PNG / PDF）</div>
    </div>
    <div class="step-item">
      <div class="step-num">4</div>
      <div class="step-text">確認資料無誤後點「<strong>送出申請</strong>」，等待承辦學校審核</div>
    </div>
  </div>

  <div class="screenshot-wrap">
    <div>
      <div class="sim-navbar">
        <div class="sim-navbar-left">🍱 臺中市第2區免費營養午餐核銷系統 <span class="sim-year-badge">115 學年度</span></div>
        <div class="sim-navbar-right">神岡區社口國民小學</div>
      </div>
      <div class="sim-form">
        <div class="sim-back">← 返回首頁</div>
        <div class="sim-form-title">🏦 帳戶資訊變更申請</div>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#0369a1;margin-bottom:6px;">目前登記帳戶</div>
          <div style="font-size:11px;color:#0c4a6e;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <span style="display:flex;align-items:center;gap:4px;">銀行：<span style="background:#cbd5e1;border-radius:3px;color:transparent;min-width:56px;display:inline-block;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
            <span style="display:flex;align-items:center;gap:4px;">帳戶名稱：<span style="background:#cbd5e1;border-radius:3px;color:transparent;min-width:72px;display:inline-block;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
            <span style="display:flex;align-items:center;gap:4px;">局號：<span style="background:#cbd5e1;border-radius:3px;color:transparent;min-width:48px;display:inline-block;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
            <span style="grid-column:1/-1;display:flex;align-items:center;gap:4px;">帳號：<span style="background:#cbd5e1;border-radius:3px;color:transparent;min-width:150px;display:inline-block;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
          </div>
        </div>
        <div class="sim-section">填寫新帳戶資訊</div>
        <div class="sim-field"><div class="sim-label">銀行名稱</div><div class="sim-input" style="color:transparent;background:linear-gradient(90deg,#e2e8f0 0%,#cbd5e1 100%);border-color:#e2e8f0;">████████</div></div>
        <div class="sim-field"><div class="sim-label">帳戶名稱</div><div class="sim-input" style="color:transparent;background:linear-gradient(90deg,#e2e8f0 0%,#cbd5e1 100%);border-color:#e2e8f0;">████████████</div></div>
        <div class="sim-row">
          <div class="sim-field"><div class="sim-label">局號</div><div class="sim-input" style="color:transparent;background:linear-gradient(90deg,#e2e8f0 0%,#cbd5e1 100%);border-color:#e2e8f0;">███████</div></div>
          <div class="sim-field"><div class="sim-label">帳號</div><div class="sim-input" style="color:transparent;background:linear-gradient(90deg,#e2e8f0 0%,#cbd5e1 100%);border-color:#e2e8f0;">███████████████</div></div>
        </div>
        <div class="sim-section">上傳帳戶憑證圖檔</div>
        <div class="sim-file-zone">
          <div class="sim-file-zone-icon">📎</div>
          <div>點此選擇或拖曳檔案</div>
          <div style="font-size:10px;margin-top:4px;">支援 JPG、PNG、PDF（存摺封面或帳戶資訊頁）</div>
        </div>
        <div class="sim-submit">送出申請</div>
      </div>
    </div>
    <div class="screenshot-caption">▸ 帳戶資訊變更申請頁面 — 填妥新帳號資訊並上傳存摺圖檔後送出</div>
  </div>

  <div class="warn">⚠️ 送出後請等待承辦學校審核，每學年度僅能有一筆待審申請。若填錯請立即聯絡承辦學校。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第5頁：填寫實支金額 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">五</div>
    <div class="page-title">填寫實支金額並下載結算表</div>
  </div>

  <p class="desc">在每學期結束時，需填入本學期的實支總金額，系統會自動計算結餘款，並產生收支結算表供下載列印。</p>
  <div class="warn">⚠️ <strong>防呆提醒：</strong>實支金額不可超過核定金額，超過時系統會即時顯示紅色警示，且無法點選「儲存」按鈕，請確認金額正確後再儲存。</div>

  <div class="steps">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-text">點選首頁對應學期的「<strong>填寫實支金額</strong>」</div>
    </div>
    <div class="step-item">
      <div class="step-num">2</div>
      <div class="step-text">在「業務費（經常門）」欄位填入本學期<strong>實支金額</strong>（元，整數）</div>
    </div>
    <div class="step-item">
      <div class="step-num">3</div>
      <div class="step-text">確認系統計算的 <strong>E. 計畫結餘款</strong> 與 <strong>F. 應繳回本局</strong> 金額正確</div>
    </div>
    <div class="step-item">
      <div class="step-num">4</div>
      <div class="step-text">點「<strong>儲存</strong>」鎖定金額；再點「<strong>下載經費收支結算表 PDF</strong>」取得結算表</div>
    </div>
  </div>

  <div class="screenshot-wrap">
    <div style="background:#f8fafc;padding:8px 12px;">
      <div style="font-size:10px;color:#64748b;margin-bottom:6px;">← 返回首頁 / 第1學期・填寫實支金額</div>
      <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:12px 16px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px;">填寫實支金額・115學年度第1學期</div>
        <!-- A B C compact -->
        <div style="background:#eff6ff;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;"><span style="color:#2563eb;font-weight:600;">A. 核定計畫金額</span><span style="font-weight:700;color:#1d4ed8;">NT$ 6,890,880</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:3px;"><span style="color:#2563eb;font-weight:600;">B. 核定補助金額</span><span style="font-weight:700;">NT$ 6,890,880</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:3px;"><span style="color:#2563eb;font-weight:600;">C. 補助比率 (B/A)</span><span style="font-weight:700;">100.00%</span></div>
        </div>
        <!-- D locked -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-size:10px;color:#64748b;">D. 實支總額・業務費（經常門）</div><div style="font-size:14px;font-weight:700;color:#1e293b;">NT$ 6,840,000</div></div>
          <div style="font-size:10px;color:#d97706;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:3px 8px;">🔒 已鎖定</div>
        </div>
        <!-- E F -->
        <div style="background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;"><span style="color:#ea580c;font-weight:600;">E. 計畫結餘款 (A-D)</span><span style="font-weight:700;color:#ea580c;">NT$ 50,880</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:#dc2626;font-weight:600;">F. 應繳回本局 (E×C，無條件進位)</span><span style="font-weight:700;color:#dc2626;">NT$ 50,880</span></div>
        </div>
        <div style="background:#16a34a;color:white;border-radius:8px;padding:8px;text-align:center;font-size:12px;font-weight:700;margin-bottom:6px;">下載經費收支結算表 PDF</div>
        <div style="border:1px solid #fbbf24;color:#b45309;border-radius:8px;padding:7px;text-align:center;font-size:11px;font-weight:600;">申請修改金額</div>
      </div>
    </div>
    <div class="screenshot-caption">▸ 填寫實支金額頁面（儲存後）— 金額鎖定，可下載 PDF 或提出修改申請</div>
  </div>

  <div class="tip">💡 儲存後金額即鎖定，不可直接修改。若需更正，請點「申請修改金額」填寫新金額與原因，送出後由承辦學校審核，核准後再重新下載結算表。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第6頁：上傳結算表 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">六</div>
    <div class="page-title">上傳收支結算表掃描檔</div>
  </div>

  <p class="desc">下載結算表後，需列印出來逐級核章，再掃描上傳至系統。上傳後由承辦學校審核，核准後即生效。</p>

  <div class="steps">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-text">將下載的結算表 PDF <strong>列印</strong>出來<strong>逐級核章</strong>，掃描存成 PDF / JPG / PNG</div>
    </div>
    <div class="step-item">
      <div class="step-num">2</div>
      <div class="step-text">進入「<strong>上傳經費收支結算表掃描檔</strong>」頁面，選擇檔案後點「<strong>確認上傳</strong>」</div>
    </div>
    <div class="step-item">
      <div class="step-num">3</div>
      <div class="step-text">頁面顯示「⏳ 待審核中」，首頁步驟也更新為橘黃色沙漏圖示，<strong>請勿重複上傳</strong></div>
    </div>
    <div class="step-item">
      <div class="step-num">4</div>
      <div class="step-text">承辦學校核准後，頁面顯示「<strong>✓ 已核准</strong>」即完成；如需換檔，點「<strong>申請重新上傳</strong>」</div>
    </div>
  </div>

  <div class="screenshot-wrap">
    <div>
      <div class="sim-navbar">
        <div class="sim-navbar-left">🍱 臺中市第2區免費營養午餐核銷系統 <span class="sim-year-badge">115 學年度</span></div>
        <div class="sim-navbar-right">神岡區社口國民小學</div>
      </div>
      <div style="background:#f1f5f9;padding:6px 12px;font-size:11px;color:#64748b;">
        ← 返回首頁 / 第1學期・上傳結算表掃描檔
      </div>
      <div class="sim-form">
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">上傳經費收支結算表掃描檔</div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;border-radius:99px;padding:1px 6px;">✓ 已核准</span>
            <div style="font-size:11px;font-weight:700;color:#1d4ed8;">此學期已上傳掃描檔</div>
          </div>
          <div style="font-size:11px;color:#2563eb;">📄 開啟已上傳的檔案</div>
        </div>
        <div style="border:1px solid #fbbf24;color:#b45309;border-radius:8px;padding:7px;text-align:center;font-size:12px;font-weight:600;">申請重新上傳</div>
      </div>
    </div>
    <div class="screenshot-caption">▸ 核准後畫面 — 顯示「✓ 已核准」及檔案連結；若需換檔請點「申請重新上傳」</div>
  </div>

  <div class="warn">⚠️ 請確認掃描檔清晰可辨、蓋章完整。上傳後勿重複上傳，等待審核即可。若需更換，點「申請重新上傳」填寫原因後送出，由承辦學校審核後自動替換。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第7頁：送款憑單 ══════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-step">七</div>
    <div class="page-title">上傳賸餘款送款憑單（第2學期末）</div>
  </div>

  <p class="desc">若第2學期結束後有賸餘款，需將賸餘款繳回公庫，並將銀行送款憑單上傳至系統。若無賸餘款則此步驟不需操作。</p>

  <div class="steps">
    <div class="step-item">
      <div class="step-num">1</div>
      <div class="step-text">確認首頁第2學期摘要顯示有「<strong>結餘款</strong>」金額</div>
    </div>
    <div class="step-item">
      <div class="step-num">2</div>
      <div class="step-text">依規定至銀行將賸餘款<strong>繳回公庫</strong>，取得送款憑單</div>
    </div>
    <div class="step-item">
      <div class="step-num">3</div>
      <div class="step-text">掃描或拍照存成 PDF / JPG / PNG</div>
    </div>
    <div class="step-item">
      <div class="step-num">4</div>
      <div class="step-text">進入「<strong>上傳賸餘款送款憑單</strong>」頁面，填入<strong>繳款日期</strong></div>
    </div>
    <div class="step-item">
      <div class="step-num">5</div>
      <div class="step-text">選擇憑單檔案後點「<strong>確認上傳送款憑單</strong>」，頁面顯示「⏳ 待審核中」</div>
    </div>
    <div class="step-item">
      <div class="step-num">6</div>
      <div class="step-text">承辦學校審核通過後，頁面改顯示「<strong>✓ 已核准</strong>」即完成；若需換檔，請點「<strong>申請重新上傳</strong>」</div>
    </div>
  </div>

  <div class="screenshot-wrap">
    <div>
      <div class="sim-navbar">
        <div class="sim-navbar-left">🍱 臺中市第2區免費營養午餐核銷系統 <span class="sim-year-badge">115 學年度</span></div>
        <div class="sim-navbar-right">神岡區社口國民小學</div>
      </div>
      <div class="sim-form">
        <div class="sim-back">← 返回首頁</div>
        <div class="sim-form-title">💰 第2學期 上傳賸餘款送款憑單</div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;color:#c2410c;">
          本學期結餘款 <strong>NT$ 48,800</strong>，請繳回公庫後上傳送款憑單
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;text-align:center;margin-bottom:8px;">
          <div style="font-size:16px;margin-bottom:4px;">⏳</div>
          <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:2px;">送款憑單待審核中</div>
          <div style="font-size:10px;color:#92400e;">承辦學校審核通過後即生效</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="background:#dcfce7;color:#15803d;font-size:10px;font-weight:700;border-radius:99px;padding:2px 7px;">✓ 已核准</span>
            <div style="font-size:11px;font-weight:700;color:#1d4ed8;">已上傳送款憑單</div>
          </div>
          <div style="font-size:11px;color:#2563eb;">📄 開啟已上傳的憑單</div>
        </div>
        <div style="border:1px solid #fbbf24;color:#b45309;border-radius:10px;padding:8px;text-align:center;font-size:12px;font-weight:600;">申請重新上傳</div>
      </div>
    </div>
    <div class="screenshot-caption">▸ 上傳賸餘款送款憑單頁面（已上傳後）— 若需換檔請點「申請重新上傳」送審</div>
  </div>

  <div class="tip">💡 送款憑單上傳後即鎖定；若需更換，提出申請並由承辦學校核准後，新憑單自動替換舊檔。若第2學期無結餘款，此步驟不會出現，可直接略過。</div>

  <div class="page-footer">
    <span>臺中市第2區免費營養午餐核銷系統 · 學校端使用說明</span>
    <span>第 <span class="auto-pg"></span> 頁</span>
  </div>
</div>

<!-- ══════════════ 第8頁：附錄 ══════════════ -->
<div class="page" style="page-break-after:auto;">
  <div class="page-header">
    <div class="page-step">附</div>
    <div class="page-title">狀態圖示說明 &amp; 常見問題</div>
  </div>

  <div style="font-size:15px;font-weight:700;color:#1e40af;margin-bottom:14px;">八、各步驟狀態圖示說明</div>

  <div class="badge-row">
    <div class="badge-icon" style="background:#22c55e;color:white;">✓</div>
    <div class="badge-desc"><strong>綠底白勾</strong> — 此步驟已完成（核准生效）</div>
  </div>
  <div class="badge-row">
    <div class="badge-icon" style="background:#fbbf24;color:white;">⏳</div>
    <div class="badge-desc"><strong>橘黃底沙漏</strong> — 檔案已上傳，待承辦學校審核中，請勿重複上傳</div>
  </div>
  <div class="badge-row">
    <div class="badge-icon" style="background:#e2e8f0;color:#64748b;">1</div>
    <div class="badge-desc"><strong>灰底數字</strong> — 此步驟尚未完成，請點入操作</div>
  </div>
  <div class="badge-row">
    <div class="badge-icon" style="background:#dbeafe;color:#2563eb;">✎</div>
    <div class="badge-desc"><strong>藍底鉛筆</strong> — 選填項目，如需更改帳戶才需操作</div>
  </div>

  <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;margin:16px 0 24px;font-size:12px;color:#334155;">
    <strong>整體作業流程：</strong><br><br>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:2.5;">
      <span style="background:#2563eb;color:white;border-radius:6px;padding:2px 10px;">登入</span>→
      <span style="background:#2563eb;color:white;border-radius:6px;padding:2px 10px;">綁定學校</span>→
      <span style="background:#0ea5e9;color:white;border-radius:6px;padding:2px 10px;">填寫實支（第1學期）</span>→
      <span style="background:#0ea5e9;color:white;border-radius:6px;padding:2px 10px;">下載結算表</span>→
      <span style="background:#0ea5e9;color:white;border-radius:6px;padding:2px 10px;">蓋章掃描上傳</span>→
      <span style="background:#4f46e5;color:white;border-radius:6px;padding:2px 10px;">填寫實支（第2學期）</span>→
      <span style="background:#4f46e5;color:white;border-radius:6px;padding:2px 10px;">蓋章掃描上傳</span>→
      <span style="background:#d97706;color:white;border-radius:6px;padding:2px 10px;">繳回賸餘款</span>→
      <span style="background:#d97706;color:white;border-radius:6px;padding:2px 10px;">上傳送款憑單</span>→
      <span style="background:#16a34a;color:white;border-radius:6px;padding:2px 10px;">✓ 完成</span>
    </div>
  </div>

  <div style="font-size:15px;font-weight:700;color:#1e40af;margin-bottom:16px;">九、常見問題 Q&amp;A</div>

  <div class="qa-item">
    <div class="qa-q">登入後顯示「尚未綁定學校」？</div>
    <div class="qa-a">請點選「綁定學校」，在下拉選單中選擇您的學校後儲存即可。若找不到學校，請聯絡承辦學校確認學校是否已啟用。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">學校承辦人員更換，如何移交系統操作權限？</div>
    <div class="qa-a">
      <strong>方式一（舊承辦人自行操作）：</strong><br>
      由舊承辦人登入系統，在首頁右上角點「<strong>重新綁定 Gmail</strong>」解除綁定，再由新承辦人以自己的 Gmail 登入並重新綁定學校。<br><br>
      <strong>方式二（舊承辦人無法操作）：</strong><br>
      聯絡承辦學校，由管理員在後台「帳號管理 → 各校綁定帳號」找到該學校帳號並點「解綁」，新承辦人再登入完成綁定。<br><br>
      ⚠️ 移交後，新承辦人請至首頁點「<strong>✏ 編輯聯絡資訊</strong>」更新姓名、職稱與電話。
    </div>
  </div>
  <div class="qa-item">
    <div class="qa-q">首頁出現綠色或紅色通知橫幅，如何處理？</div>
    <div class="qa-a">這是承辦學校的審核結果通知。<strong>綠色（✅）</strong>表示申請已核准，檔案或金額已生效，可至對應步驟確認。<strong>紅色（❌）</strong>表示申請未通過，請重新提出申請或聯絡承辦學校了解原因。確認後點右側「<strong>✕</strong>」關閉通知，關閉後不再顯示。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">上傳檔案後首頁顯示「待審核中，請靜候通知」是什麼意思？</div>
    <div class="qa-a">這是正常狀態，表示您的檔案已成功上傳，正等待承辦學校確認。審核通過後步驟說明會自動更新為「✓ 已核准」，並會收到 Email 通知。<strong>請勿重複上傳</strong>，若長時間未獲通知，請聯絡承辦學校確認。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">審核通知信寄到哪裡？沒有收到怎麼辦？</div>
    <div class="qa-a">通知信寄至您登入系統所使用的 Gmail 帳號。若未收到，請檢查垃圾郵件資料夾，或直接登入系統查看步驟狀態是否已更新為「✓ 已核准」。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">下載的結算表金額填錯，可以修改嗎？</div>
    <div class="qa-a">儲存後金額即鎖定。請進入「填寫實支金額並下載結算表」頁面，點「申請修改金額」，填入正確金額與修改原因後送出申請，由承辦學校審核；核准後金額自動更新，即可重新下載結算表。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">結算表掃描檔或送款憑單上傳後想要換一份？</div>
    <div class="qa-a">上傳後檔案即鎖定。請進入對應頁面點「申請重新上傳」，選擇新檔案並填寫原因後送出，由承辦學校審核；核准後新檔案將自動替換舊檔。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">首頁的核定金額顯示為 0 或找不到？</div>
    <div class="qa-a">核定金額由承辦學校輸入，若顯示 0 或空白，請聯絡承辦學校確認是否已完成金額設定。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">每學年需要重新登入或重新綁定學校嗎？</div>
    <div class="qa-a">不需要。帳號綁定後長期有效，每學年直接登入即可操作。只有在承辦人更換或更換操作 Gmail 時才需要重新綁定。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">一所學校可以用多個 Gmail 帳號登入嗎？</div>
    <div class="qa-a">不可以。每所學校只能綁定 <strong>一個 Gmail 帳號</strong>進行操作。若嘗試以未綁定的帳號登入，系統會顯示「此帳號尚未綁定學校」，需重新以正確帳號登入。承辦人更換時，請依「學校承辦人員更換」步驟解除舊帳號綁定，再由新承辦人重新綁定。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">帳戶變更申請送出後發現填錯？</div>
    <div class="qa-a">請立即聯絡承辦學校，在審核前可請管理員退回申請，您再重新填寫送出。</div>
  </div>
  <div class="qa-item">
    <div class="qa-q">期間卡顯示「此階段尚未開放」？</div>
    <div class="qa-a">該期間尚未由承辦學校開放，請等待通知，開放後才能操作。</div>
  </div>

  <div style="margin-top:32px;background:linear-gradient(135deg,#1e40af,#4338ca);border-radius:12px;padding:16px 20px;color:white;">
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">聯絡承辦學校</div>
    <div style="font-size:12px;opacity:0.9;line-height:1.8;">若操作上有疑問，請洽登入頁面下方顯示的承辦學校聯絡人，<br>或聯絡教育局免費午餐業務承辦人員。</div>
  </div>

  <div style="text-align:center;margin-top:32px;font-size:11px;color:#94a3b8;">
    臺中市第2區免費營養午餐核銷系統 · 學校端使用說明 · 115 學年度
  </div>
</div>

</body>
</html>`

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
})

const page = await browser.newPage()
await page.setViewport({ width: 1240, height: 1754 })
await page.setContent(html, { waitUntil: 'networkidle0' })

const pdfPath = path.join(__dirname, '學校端使用說明.pdf')
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
})

await browser.close()
console.log('✅ PDF 產生完成：' + pdfPath)

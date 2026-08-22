function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 將純文字 body 包成 HTML 信件（管理員仍編輯純文字範本）
 */
export function wrapEmailHtml(opts: {
  body: string
  zoneName: string
  systemName: string
  hostSchool: string
  adminName: string
  adminTitle: string
  adminPhone: string
}): string {
  const { body, zoneName, systemName, hostSchool, adminName, adminTitle, adminPhone } = opts

  const bodyHtml = body
    .split('\n')
    .map(line => {
      const t = line.trim()
      if (t === '') return '<div style="height:12px"></div>'
      return `<p style="margin:0 0 10px 0;color:#1e293b;font-size:15px;line-height:1.7">${esc(t)}</p>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Microsoft JhengHei','Heiti TC',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px">
<tr><td align="center">

<!-- card -->
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <!-- header -->
  <tr>
    <td style="background:#1d4ed8;padding:24px 36px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:10px;text-align:center;vertical-align:middle;font-size:22px">📋</td>
        <td style="padding-left:14px;vertical-align:middle">
          <p style="margin:0;color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:0.02em">${esc(zoneName)}</p>
          <p style="margin:3px 0 0;color:#bfdbfe;font-size:12px">${esc(systemName)}通知</p>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- body -->
  <tr>
    <td style="padding:32px 36px 24px">
      ${bodyHtml}
    </td>
  </tr>

  <!-- divider -->
  <tr><td style="padding:0 36px"><div style="height:1px;background:#e2e8f0"></div></td></tr>

  <!-- footer -->
  <tr>
    <td style="padding:20px 36px 28px">
      <p style="margin:0;color:#475569;font-size:13px;font-weight:500">${esc(hostSchool)}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:12px">承辦人：${esc(adminName)}${adminTitle ? '　' + esc(adminTitle) : ''}${adminPhone ? '　' + esc(adminPhone) : ''}</p>
      <p style="margin:14px 0 0;color:#94a3b8;font-size:11px">此郵件由系統自動發送，請勿直接回覆</p>
    </td>
  </tr>

</table>

</td></tr>
</table>
</body>
</html>`
}

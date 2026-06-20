import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const key = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export function driveViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`
}

export function isDriveFileId(value: string) {
  // Drive file IDs are alphanumeric + dash/underscore, ~28–44 chars
  // Supabase paths contain '/'
  return !value.includes('/')
}

export async function uploadToDrive(opts: {
  buffer: ArrayBuffer
  filename: string
  mimeType: string
  folderId: string
}) {
  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })

  const { data } = await drive.files.create({
    requestBody: {
      name: opts.filename,
      parents: [opts.folderId],
    },
    media: {
      mimeType: opts.mimeType,
      body: bufferToStream(opts.buffer),
    },
    fields: 'id, webViewLink',
  })

  return { fileId: data.id!, webViewLink: data.webViewLink! }
}

// Readable stream from ArrayBuffer
function bufferToStream(buffer: ArrayBuffer) {
  const { Readable } = require('stream')
  const readable = new Readable()
  readable.push(Buffer.from(buffer))
  readable.push(null)
  return readable
}

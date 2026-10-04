'use client'
import { Suspense } from 'react'
import { FileViewer } from '@/components/FileViewer'

export default function AdminFileViewerPage() {
  return <Suspense fallback={null}><FileViewer proxyPath="/api/admin/file-proxy" showDriveLink /></Suspense>
}

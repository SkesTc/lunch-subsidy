'use client'
import { Suspense } from 'react'
import { FileViewer } from '@/components/FileViewer'

export default function SchoolFileViewerPage() {
  return <Suspense fallback={null}><FileViewer proxyPath="/api/school/file-proxy" showDriveLink={false} /></Suspense>
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewFeedPage() {
  const [url, setUrl] = useState('')
  const [validating, setValidating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState<{
    title: string
    siteUrl: string | null
    itemCount: number
  } | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleValidate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setPreview(null)
    setValidating(true)

    const res = await fetch('/api/feeds/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()
    if (data.valid) {
      setPreview(data)
    } else {
      setError(data.error ?? '无效的 RSS 地址')
    }
    setValidating(false)
  }

  async function handleCreate() {
    setCreating(true)
    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json()
      setError(data.error ?? '创建失败')
    }
    setCreating(false)
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>添加 RSS Feed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleValidate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">RSS URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setPreview(null)
              }}
              required
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" variant="secondary" disabled={validating}>
            {validating ? '验证中...' : '验证'}
          </Button>
        </form>

        {preview && (
          <div className="space-y-3 rounded-md border p-4">
            <p>
              <strong>名称:</strong> {preview.title}
            </p>
            {preview.siteUrl && (
              <p>
                <strong>站点:</strong> {preview.siteUrl}
              </p>
            )}
            <p>
              <strong>文章数:</strong> {preview.itemCount}
            </p>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '添加中...' : '确认添加'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

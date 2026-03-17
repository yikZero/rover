'use client'

import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetcher } from '@/lib/fetcher'

interface Feed {
  id: number
  title: string
  url: string
  siteUrl: string | null
  isActive: boolean
  createdAt: string
}

export default function AdminPage() {
  const { data: feeds, mutate } = useSWR<Feed[]>('/api/feeds', fetcher)

  async function toggleActive(id: number, isActive: boolean) {
    await fetch(`/api/feeds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    mutate()
  }

  async function deleteFeed(id: number) {
    if (!confirm('确定删除？')) return
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div>
      <h1 className="mb-6 font-bold text-2xl">RSS Feeds</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>状态</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {feeds?.map((feed) => (
            <TableRow key={feed.id}>
              <TableCell className="font-medium">{feed.title}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                {feed.url}
              </TableCell>
              <TableCell>
                <Switch
                  checked={feed.isActive}
                  onCheckedChange={(checked: boolean) =>
                    toggleActive(feed.id, checked)
                  }
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteFeed(feed.id)}
                >
                  删除
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {feeds?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                暂无 Feed，去添加一个吧
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

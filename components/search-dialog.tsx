'use client'

import { Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

interface SearchResult {
  similarity: number
  titleZh: string
  titleEn: string
  summaryZh: string
  summaryEn: string
  url: string
  feedTitle: string
}

export function SearchButton() {
  const t = useTranslations('SearchPage')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 500)
  const abortRef = useRef<AbortController | null>(null)

  const hasQuery = debouncedQuery.trim() !== ''

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsSearching(true)

    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Search failed: ${res.status}`)
        return res.json()
      })
      .then((data) => setResults(data.results ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSearching(false)
      })

    return () => controller.abort()
  }, [debouncedQuery])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setResults([])
      setQuery('')
    }
    setOpen(open)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-m-2 flex items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t('title')}
      >
        <Search className="size-5" />
      </button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t('title')}
        description={t('placeholder')}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('placeholder')}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-80">
            {isSearching && (
              <div className="space-y-1 p-2">
                <div className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-full animate-pulse rounded bg-muted/60" />
                </div>
                <div className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-5/6 animate-pulse rounded bg-muted/60" />
                </div>
                <div className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted/60" />
                </div>
              </div>
            )}

            {!isSearching && hasQuery && results.length === 0 && (
              <CommandEmpty>{t('noResults')}</CommandEmpty>
            )}

            {!isSearching && results.length > 0 && (
              <CommandGroup heading={t('found', { count: results.length })}>
                {results.map((result) => {
                  const title =
                    locale === 'en' ? result.titleEn : result.titleZh
                  const summary =
                    locale === 'en' ? result.summaryEn : result.summaryZh
                  return (
                    <CommandItem
                      key={result.url}
                      value={result.url}
                      onSelect={() => {
                        window.open(result.url, '_blank', 'noopener,noreferrer')
                      }}
                      showCheck={false}
                      className="flex flex-col items-start gap-1"
                    >
                      <span className="font-medium text-sm leading-snug">
                        {title}
                      </span>
                      <span className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                        {summary}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}

            {!isSearching && !hasQuery && (
              <div className="py-8 text-center text-muted-foreground/40 text-sm">
                {t('hint')}
              </div>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

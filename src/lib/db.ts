import { DATABASE_URL } from 'astro:env/server'
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

interface HyperdriveBinding {
  connectionString: string
}

const hyperdrive = (env as Record<string, unknown>).HYPERDRIVE as
  | HyperdriveBinding
  | undefined

export function getDb() {
  const client = postgres(hyperdrive?.connectionString ?? DATABASE_URL, {
    prepare: false,
  })
  return drizzle({ client })
}

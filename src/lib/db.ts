import { DATABASE_URL } from 'astro:env/server'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(DATABASE_URL, { prepare: false })
export const db = drizzle({ client })

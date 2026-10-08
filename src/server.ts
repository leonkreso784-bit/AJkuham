import 'dotenv/config'
import { serve } from '@hono/node-server'
import { env } from './env.js'
import { app } from './app.js'

/** Lokalni dev i Railway: Node server. Vercel ide kroz api/index.ts. */
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`KuhAI API slusa na http://localhost:${info.port}`)
})

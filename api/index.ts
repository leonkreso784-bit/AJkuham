import { handle } from 'hono/vercel'
import { app } from '../src/app.js'

/** Vercel ulaz (vercel.json rewrita sve na ovu funkciju). Railway koristi src/server.ts. */
export default handle(app)

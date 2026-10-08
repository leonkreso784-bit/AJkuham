#!/usr/bin/env node
/**
 * Statusline wrapper za KuhAI.
 *
 * Doda SHAKER countdown na pocetak, pa proslijedi stdin postojecem
 * claude-manager statuslineu i prilijepi njegov izlaz. Tako timer radi
 * kroz sve sesije a Leonov postojeci statusline ostaje netaknut.
 *
 * Rok se cita iz .claude/deadline.json na svaki render — promjena tamo
 * vrijedi odmah, bez restarta.
 *
 * Nikad ne smije puknuti: statusline koji padne ostavi prazan red.
 */

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const INNER = 'C:\\Users\\leonk\\.claude\\.claude-manager\\statusline-tap.js'

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function countdown() {
  let deadline
  try {
    const raw = JSON.parse(readFileSync(join(HERE, 'deadline.json'), 'utf8'))
    // Namjerno bez timezone suffixa -> Date parsira kao lokalno vrijeme.
    deadline = new Date(raw.deadlineLocal)
    if (Number.isNaN(deadline.getTime())) return ''
  } catch {
    return ''
  }

  const msLeft = deadline.getTime() - Date.now()

  if (msLeft <= 0) {
    const over = Math.floor(-msLeft / 60000)
    return `\x1b[1;31mSHAKER +${Math.floor(over / 60)}h${String(over % 60).padStart(2, '0')}m\x1b[0m`
  }

  const totalMin = Math.floor(msLeft / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const t = `${h}h${String(m).padStart(2, '0')}m`

  // zeleno > 3h, zuto 1-3h, crveno < 1h
  const color = totalMin > 180 ? '\x1b[32m' : totalMin > 60 ? '\x1b[33m' : '\x1b[1;31m'
  return `${color}SHAKER ${t}\x1b[0m`
}

function inner(stdin) {
  try {
    const r = spawnSync(process.execPath, [INNER], {
      input: stdin,
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true,
    })
    return (r.stdout || '').trim()
  } catch {
    return ''
  }
}

const stdin = readStdin()
const parts = [countdown(), inner(stdin)].filter(Boolean)
process.stdout.write(parts.join('  \x1b[2m|\x1b[0m  '))

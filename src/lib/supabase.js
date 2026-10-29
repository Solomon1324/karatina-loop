import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function isLegacyAnonKey(key) {
  if (!key?.startsWith('eyJ')) return false
  try {
    const payload = key.split('.')[1]
    if (!payload) return false
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    return JSON.parse(decoded).role === 'anon'
  } catch {
    return false
  }
}

// Only accept a publishable key or a legacy JWT whose role is explicitly "anon".
// This prevents accidentally enabling browser use with a service_role JWT.
const isBrowserSafeKey = publicKey?.startsWith('sb_publishable_') || isLegacyAnonKey(publicKey)
export const isSupabaseConfigured = Boolean(url && isBrowserSafeKey)
export const supabase = isSupabaseConfigured ? createClient(url, publicKey) : null

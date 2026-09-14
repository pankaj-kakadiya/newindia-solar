import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cdtbwuagqxkknkccpkcr.supabase.co'
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_M81dfHhhhIn5jIUkSlDNVg_ml07slT-'

export const supabase = createClient(url, key)

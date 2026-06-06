import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bwaoxwfkqqpqvtpynwzh.supabase.co'
const supabaseKey = 'sb_publishable_SsnkELg6dLx--AjHaW0ShA_N1ISmMKg'

export const supabase = createClient(supabaseUrl, supabaseKey)
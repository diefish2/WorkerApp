import { createClient } from '@supabase/supabase-js';

// Public frontend connection settings.
// IMPORTANT: this is a publishable key, not a service-role/secret key.
const SUPABASE_URL = 'https://dodranncekcrsnackzzx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vyW9CJha_XIO1jkZF9Wnyw_USJJnv58';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

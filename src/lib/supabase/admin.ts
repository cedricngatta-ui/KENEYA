import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Pas de repli silencieux sur la clé anon : les appels admin échoueraient de façon confuse
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurées.');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

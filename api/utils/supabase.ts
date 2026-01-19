import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    // Warn or error if env vars are missing
    console.warn("Supabase credentials missing in API env");
}

export const getSupabase = () => {
    return createClient(supabaseUrl!, supabaseServiceKey!);
};

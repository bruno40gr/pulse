import { createClient } from '@supabase/supabase-js';

// For use in client components
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// For use in server-side routes and actions
// Note: We are using the service_role key here for elevated privileges,
// as specified in the project requirements. This bypasses RLS.
// In a multi-user app, you would typically create a new client for each
// request with the user's auth token.
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keep automatic token refresh — but our AuthContext handles failures gracefully
    autoRefreshToken: true,
    // Persist session to localStorage so it survives page refreshes
    persistSession: true,
    // Prevent Supabase from parsing OAuth tokens from URL hash on every load
    // (we don't use OAuth redirect flow)
    detectSessionInUrl: false,
    // CRITICAL: Disable multi-tab lock coordination.
    // Supabase uses the Web Locks API to synchronize token refresh across tabs.
    // When a tab is backgrounded or frozen, the lock can time out and cause
    // NavigatorLockAcquireTimeoutError, which puts the client into a retry
    // loop that never resolves. Setting this to false avoids the lock entirely.
    // Trade-off: each tab refreshes tokens independently, but this is far
    // safer than risking a deadlock that freezes the entire app.
    // @ts-expect-error — multiTab is a valid Supabase auth option but may not be in all type defs
    multiTab: false,
  },
});

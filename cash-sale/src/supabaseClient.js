import {createClient} from '@supabase/supabase-js';
export const supabase=createClient(process.env.REACT_APP_SUPABASE_URL,process.env.REACT_APP_SUPABASE_ANON_KEY);
// Separate client so a supervisor can approve on a cashier's device without switching accounts
export const authClient=()=>createClient(process.env.REACT_APP_SUPABASE_URL,process.env.REACT_APP_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'sup-approval'}});

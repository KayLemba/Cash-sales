// Deploy with: supabase functions deploy create-staff
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by Supabase at runtime - you do not set these yourself.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Confirm who is calling, using their own token (not the service key)
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401 });

    const admin = createClient(url, serviceKey);
    const { data: me } = await admin.from("profiles").select("role,disabled").eq("id", user.id).single();
    if (!me || me.disabled || !["owner", "supervisor"].includes(me.role))
      return new Response(JSON.stringify({ error: "Only an owner or supervisor can create accounts" }), { status: 403 });

    const { email, password, name, role } = await req.json();
    if (!email || !password || password.length < 6)
      return new Response(JSON.stringify({ error: "Email and a password of 6+ characters are required" }), { status: 400 });
    if (!["cashier", "supervisor"].includes(role))
      return new Response(JSON.stringify({ error: "Role must be cashier or supervisor" }), { status: 400 });
    if (role === "supervisor" && me.role !== "owner")
      return new Response(JSON.stringify({ error: "Only an owner can create a supervisor account" }), { status: 403 });

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { created_by_admin: true, role, name: name || email.split("@")[0] }
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    return new Response(JSON.stringify({ ok: true, id: data.user.id }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

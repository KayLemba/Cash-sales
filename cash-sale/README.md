# ShopDesk
1. Supabase: SQL Editor > run `schema.sql`, then `upgrade.sql`, then `upgrade2.sql`. Authentication > turn off "Confirm email" while testing.
2. Copy `.env.example` to `.env`, add your Project URL and anon key (Project Settings > API).
3. `npm install` then `npm start`.
4. Create an account in the app, then run in the SQL editor: `update profiles set role='owner' where name='your-email-prefix';`
5. Set other staff to 'cashier' or 'supervisor' the same way.

## Account creation (owner/supervisor only)
Run `upgrade3.sql` in Supabase's SQL Editor after upgrade2.sql. This also requires a small Edge Function so new accounts can be created securely:

```
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF   # find this in your Supabase project URL
supabase functions deploy create-staff
```

No secrets to configure — Supabase gives the function the keys it needs automatically. After this, the sign-up screen only works once (for the very first owner); everyone else is created from the Staff tab.

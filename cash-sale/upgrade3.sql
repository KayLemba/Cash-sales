-- Run AFTER schema.sql, upgrade.sql, upgrade2.sql
alter table profiles add column if not exists email text;
alter table profiles add column if not exists disabled boolean not null default false;
update profiles set email=(select email from auth.users u where u.id=profiles.id) where email is null;

-- Replace the signup trigger: first-ever account becomes owner; after that,
-- self sign-up is rejected unless the account was created by an owner/supervisor
-- through the create-staff edge function (which sets created_by_admin=true).
drop trigger if exists t_signup on auth.users;
drop function if exists on_signup();
create function public.on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner_exists boolean; admin_flag boolean; r text;
begin
  select exists(select 1 from profiles where role='owner') into owner_exists;
  admin_flag := coalesce((new.raw_user_meta_data->>'created_by_admin')::boolean,false);
  if owner_exists and not admin_flag then
    raise exception 'Self sign-up is disabled. Ask your owner or supervisor to create your account.';
  end if;
  r := case when not owner_exists then 'owner' else coalesce(new.raw_user_meta_data->>'role','cashier') end;
  insert into public.profiles(id,name,email,role)
  values(new.id, coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)), new.email, r);
  return new;
end; $$;
create trigger t_signup after insert on auth.users for each row execute function public.on_signup();

-- Owner or supervisor can disable/enable a non-owner account
create function set_disabled(p_id uuid,p_disabled boolean) returns void
language plpgsql security definer as $$
begin
  if my_role() not in('owner','supervisor') then raise exception 'Only an owner or supervisor can do that';end if;
  if p_disabled and (select role from profiles where id=p_id)='owner' then raise exception 'Cannot disable an owner account';end if;
  update profiles set disabled=p_disabled where id=p_id;
end; $$;

-- Block disabled accounts from selling or approving returns, even if they keep a valid login
create or replace function create_sale(p_items jsonb,p_payments jsonb) returns uuid language plpgsql security definer as $$
declare sid uuid;i jsonb;p products;t numeric:=0;paid numeric:=0;begin
 if auth.uid() is null then raise exception 'Not signed in';end if;
 if(select disabled from profiles where id=auth.uid())then raise exception 'Your account has been disabled.';end if;
 insert into sales(cashier,total) values(auth.uid(),0) returning id into sid;
 for i in select * from jsonb_array_elements(p_items) loop
  select * into p from products where id=(i->>'id')::uuid for update;
  if p.stock<(i->>'qty')::int then raise exception 'Not enough stock for %',p.name;end if;
  update products set stock=stock-(i->>'qty')::int where id=p.id;
  insert into sale_items(sale_id,product_id,name,qty,price) values(sid,p.id,p.name||coalesce(' - '||p.variant,''),(i->>'qty')::int,p.price);
  t:=t+p.price*(i->>'qty')::int;
 end loop;
 for i in select * from jsonb_array_elements(p_payments) loop
  insert into payments(sale_id,method,amount) values(sid,i->>'method',(i->>'amount')::numeric);paid:=paid+(i->>'amount')::numeric;
 end loop;
 if paid<>t then raise exception 'Payments (%) must equal the total (%)',paid,t;end if;
 update sales set total=t where id=sid;return sid;end$$;

create or replace function decide_return(p_id uuid,p_ok boolean) returns void language plpgsql security definer as $$
declare r sale_returns;done int;q int;begin
 if my_role() not in('supervisor','owner') then raise exception 'Supervisor approval required';end if;
 if(select disabled from profiles where id=auth.uid())then raise exception 'Your account has been disabled.';end if;
 select * into r from sale_returns where id=p_id for update;
 if r.status<>'pending' then raise exception 'Already decided';end if;
 if p_ok then
  select qty into q from sale_items where id=r.sale_item_id;
  select coalesce(sum(qty),0) into done from sale_returns where sale_item_id=r.sale_item_id and status='approved';
  if done+r.qty>q then raise exception 'More returned than was sold';end if;
  update products set stock=stock+r.qty where id=r.product_id;
 end if;
 update sale_returns set status=case when p_ok then 'approved' else 'rejected' end,approved_by=auth.uid() where id=p_id;end$$;

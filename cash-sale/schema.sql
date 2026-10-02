-- Paste into Supabase > SQL Editor > Run
create table profiles(id uuid primary key references auth.users on delete cascade,name text,role text not null default 'cashier' check(role in('cashier','supervisor','owner')));
create table products(id uuid primary key default gen_random_uuid(),name text not null,price numeric not null,stock int not null default 0,low_at int not null default 5);
create table sales(id uuid primary key default gen_random_uuid(),cashier uuid references profiles(id) default auth.uid(),method text not null check(method in('cash','airtel','mtn','bank')),total numeric not null,created_at timestamptz default now());
create table sale_items(id uuid primary key default gen_random_uuid(),sale_id uuid references sales on delete cascade,product_id uuid references products,name text,qty int not null,price numeric not null);

create function my_role() returns text language sql security definer as $$select role from profiles where id=auth.uid()$$;
create function on_signup() returns trigger language plpgsql security definer as $$begin insert into profiles(id,name) values(new.id,split_part(new.email,'@',1));return new;end$$;
create trigger t_signup after insert on auth.users for each row execute function on_signup();

-- Atomic sale: checks stock, deducts it, records items
create function create_sale(p_method text,p_items jsonb) returns uuid language plpgsql security definer as $$
declare sid uuid;i jsonb;p products;t numeric:=0;begin
 if auth.uid() is null then raise exception 'Not signed in';end if;
 insert into sales(cashier,method,total) values(auth.uid(),p_method,0) returning id into sid;
 for i in select * from jsonb_array_elements(p_items) loop
  select * into p from products where id=(i->>'id')::uuid for update;
  if p.stock<(i->>'qty')::int then raise exception 'Not enough stock for %',p.name;end if;
  update products set stock=stock-(i->>'qty')::int where id=p.id;
  insert into sale_items(sale_id,product_id,name,qty,price) values(sid,p.id,p.name,(i->>'qty')::int,p.price);
  t:=t+p.price*(i->>'qty')::int;
 end loop;
 update sales set total=t where id=sid;return sid;end$$;

alter table profiles enable row level security;alter table products enable row level security;
alter table sales enable row level security;alter table sale_items enable row level security;
create policy "read profiles" on profiles for select to authenticated using(true);
create policy "owner edits profiles" on profiles for update to authenticated using(my_role()='owner');
create policy "read products" on products for select to authenticated using(true);
create policy "owner writes products" on products for all to authenticated using(my_role()='owner') with check(my_role()='owner');
create policy "read sales" on sales for select to authenticated using(cashier=auth.uid() or my_role() in('owner','supervisor'));
create policy "read items" on sale_items for select to authenticated using(exists(select 1 from sales s where s.id=sale_id));
-- After you sign up, make yourself owner:
-- update profiles set role='owner' where name='your-email-prefix';

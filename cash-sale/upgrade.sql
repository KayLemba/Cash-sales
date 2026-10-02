-- Run AFTER schema.sql. Adds variants, split payments, returns and cash-up.
alter table products add column variant text;
create table payments(id uuid primary key default gen_random_uuid(),sale_id uuid references sales on delete cascade,method text not null check(method in('cash','airtel','mtn','bank')),amount numeric not null);
insert into payments(sale_id,method,amount) select id,method,total from sales;
alter table sales drop column method;
alter table payments enable row level security;
create policy "read payments" on payments for select to authenticated using(exists(select 1 from sales s where s.id=sale_id));

drop function create_sale(text,jsonb);
create function create_sale(p_items jsonb,p_payments jsonb) returns uuid language plpgsql security definer as $$
declare sid uuid;i jsonb;p products;t numeric:=0;paid numeric:=0;begin
 if auth.uid() is null then raise exception 'Not signed in';end if;
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

create table sale_returns(id uuid primary key default gen_random_uuid(),sale_item_id uuid references sale_items,product_id uuid references products,
 qty int not null check(qty>0),amount numeric not null,reason text,method text not null check(method in('cash','airtel','mtn','bank')),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 requested_by uuid references profiles(id) default auth.uid(),approved_by uuid references profiles(id),created_at timestamptz default now());
alter table sale_returns enable row level security;
create policy "read returns" on sale_returns for select to authenticated using(requested_by=auth.uid() or my_role() in('owner','supervisor'));
create policy "request return" on sale_returns for insert to authenticated with check(requested_by=auth.uid() and status='pending');

create function decide_return(p_id uuid,p_ok boolean) returns void language plpgsql security definer as $$
declare r sale_returns;done int;q int;begin
 if my_role() not in('supervisor','owner') then raise exception 'Supervisor approval required';end if;
 select * into r from sale_returns where id=p_id for update;
 if r.status<>'pending' then raise exception 'Already decided';end if;
 if p_ok then
  select qty into q from sale_items where id=r.sale_item_id;
  select coalesce(sum(qty),0) into done from sale_returns where sale_item_id=r.sale_item_id and status='approved';
  if done+r.qty>q then raise exception 'More returned than was sold';end if;
  update products set stock=stock+r.qty where id=r.product_id;
 end if;
 update sale_returns set status=case when p_ok then 'approved' else 'rejected' end,approved_by=auth.uid() where id=p_id;end$$;

create table cash_ups(id uuid primary key default gen_random_uuid(),day date not null,expected jsonb,counted jsonb,note text,
 by uuid references profiles(id) default auth.uid(),created_at timestamptz default now());
alter table cash_ups enable row level security;
create policy "boss reads cashups" on cash_ups for select to authenticated using(my_role() in('owner','supervisor'));
create policy "boss writes cashups" on cash_ups for insert to authenticated with check(my_role() in('owner','supervisor'));

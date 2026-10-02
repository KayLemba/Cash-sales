-- Run AFTER schema.sql and upgrade.sql
alter table products add column if not exists active boolean not null default true;

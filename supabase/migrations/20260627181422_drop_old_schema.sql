/*
# Drop old schema tables

Drops the previous simplified schema (locations, products, audits, audit_items)
to make way for the full redesigned warehouse audit system schema.
All previous data was demo/seed data.
*/
DROP TABLE IF EXISTS audit_items CASCADE;
DROP TABLE IF EXISTS audits CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

-- Rich body: blocks (text + images interleaved) for anuncis, actes, events, votacions
alter table anuncis    add column if not exists cos_blocks        jsonb;
alter table actes      add column if not exists contingut_blocks  jsonb;
alter table events     add column if not exists descripcio_blocks jsonb;
alter table votacions  add column if not exists descripcio_blocks jsonb;

-- Allow null on legacy text fields so new records can omit them
alter table anuncis alter column cos drop not null;
alter table actes   alter column contingut drop not null;

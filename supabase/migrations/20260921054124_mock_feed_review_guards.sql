create or replace function private.bind_mock_item_to_product() returns trigger
language plpgsql set search_path=public,private as $$
declare source_feed_id uuid;
begin
  if new.product_id is not null and old.product_id is distinct from new.product_id
    and new.raw_data->>'source'='mock_feed' then
    select feed_id into source_feed_id from public.product_feed_runs where import_batch_id=new.batch_id limit 1;
    if source_feed_id is not null then
      update public.product_feed_mock_items set match_product_id=new.product_id
      where feed_id=source_feed_id and external_key=new.raw_data->>'external_key';
    end if;
  end if;
  return new;
end;
$$;
create trigger bind_mock_item_to_product after update of product_id on public.import_batch_rows
for each row execute function private.bind_mock_item_to_product();

create or replace function private.hold_pending_mock_feed_schedule() returns trigger
language plpgsql set search_path=public,private as $$
begin
  if new.feed_url like 'mock://%' and exists(
    select 1 from public.product_feed_runs r where r.feed_id=new.id and r.status='pending_review'
  ) then new.next_run_at:=null; end if;
  return new;
end;
$$;
create trigger hold_pending_mock_feed_schedule before update on public.product_feeds
for each row execute function private.hold_pending_mock_feed_schedule();

create or replace function private.resume_mock_feed_after_review() returns trigger
language plpgsql set search_path=public,private as $$
begin
  if old.status='pending_review' and new.status in ('approved','rejected') then
    update public.product_feeds f set
      next_run_at=case when f.status='active' and f.feed_url like 'mock://%' then
        case f.frequency
          when '6_hours' then now()+interval '6 hours'
          when '12_hours' then now()+interval '12 hours'
          when 'daily' then now()+interval '1 day'
          when 'weekly' then now()+interval '7 days'
          else null
        end
      else null end,
      updated_at=now()
    where f.id=new.feed_id;
  end if;
  return new;
end;
$$;
create trigger resume_mock_feed_after_review after update of status on public.product_feed_runs
for each row execute function private.resume_mock_feed_after_review();

revoke all on function private.bind_mock_item_to_product() from public,anon,authenticated;
revoke all on function private.hold_pending_mock_feed_schedule() from public,anon,authenticated;
revoke all on function private.resume_mock_feed_after_review() from public,anon,authenticated;

-- Give the new "Complete client handoff" task (20260930280000) a default
-- estimate, same as every other named production task in
-- production_task_estimated_hours() (20260915000000, left untouched).
-- Whole-function create-or-replace since Postgres has no way to patch one
-- branch of a plpgsql function body in place; every other line is
-- byte-for-byte identical to the current definition.

create or replace function public.production_task_estimated_hours(p_title text)
returns numeric
language plpgsql
immutable
as $$
declare
  key text := public.production_task_title_key(p_title);
begin
  if key = '' then
    return null;
  end if;

  -- Exact, title-specific estimates.
  if key = 'review approved scope' then return 0.5; end if;
  if key = 'confirm sitemap and requirements' then return 1; end if;
  if key = 'collect/confirm client content and assets' then return 1; end if;
  if key = 'prepare contact information' then return 0.5; end if;
  if key = 'migrate approved content' then return 2; end if;
  if key = 'establish design direction' then return 3; end if;
  if key = 'design brand identity / logo' then return 4; end if;
  if key = 'design responsive/mobile layouts' then return 2; end if;
  if key = 'implement responsive layouts' then return 3; end if;
  if key = 'integrate approved content' then return 2; end if;
  if key = 'prepare/deploy staging' then return 1; end if;
  if key = 'prepare staging for client review' then return 0.5; end if;
  if key = 'address requested revisions' then return 2; end if;
  if key = 'test staging website' then return 1.5; end if;
  if key = 'test responsive layouts' then return 1; end if;
  if key = 'accessibility audit (ada/wcag)' then return 2; end if;
  if key = 'deploy production' then return 1; end if;
  if key = 'verify production website' then return 0.5; end if;
  if key = 'set up ad campaign' then return 2; end if;
  if key = 'set up social media & content calendar' then return 2; end if;
  if key = 'final qa' then return 1; end if;
  if key = 'complete client handoff' then return 1; end if;

  -- Per-page copy/design/build: homepage runs a bit longer than inner pages.
  if key = 'write homepage copy' then return 2; end if;
  if key like 'write % copy' then return 1.5; end if;

  if key = 'design homepage' then return 4; end if;
  if key like 'design %' then return 3; end if;

  if key = 'build homepage' then return 5; end if;
  if key like 'build %' then return 4; end if;

  -- Feature implementation: complexity varies a lot by feature.
  if key in ('implement e-commerce functionality', 'implement online store') then return 8; end if;
  if key = 'implement customer login' then return 4; end if;
  if key = 'implement online payments' then return 3; end if;
  if key = 'implement booking / appointment form' then return 2; end if;
  if key = 'implement quote request form' then return 1.5; end if;
  if key = 'implement contact form' then return 1; end if;
  if key like 'implement %' then return 2; end if;

  if key = 'set up seo' then return 2; end if;
  if key = 'set up hosting' then return 1; end if;
  if key = 'set up business email' then return 0.5; end if;
  if key like 'set up %' then return 1; end if;

  if key like 'install %' then return 0.5; end if;
  if key like 'connect %' then return 0.5; end if;

  if key = 'add newsletter signup' then return 1; end if;
  if key = 'add live chat' then return 1; end if;
  if key like 'add %' then return 0.5; end if;

  if key = 'performance optimization' then return 2; end if;
  if key = 'security setup' then return 1; end if;

  -- Any remaining "test X" is a single-feature QA pass.
  if key like 'test %' then return 0.5; end if;

  return null;
end;
$$;

comment on function public.production_task_estimated_hours(text) is
  'Default effort estimate (hours) for a known production task title. Null for unrecognized/custom titles -- never a forced value, only a default for blank estimated_hours.';

revoke all on function public.production_task_estimated_hours(text) from public, anon, authenticated;

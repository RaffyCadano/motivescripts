-- Recommended role hints for production tasks (recommendation only — not auto-assignment).

alter table public.tasks
  add column if not exists recommended_role text
  check (
    recommended_role is null
    or recommended_role in ('project_manager', 'designer', 'developer', 'content_writer', 'team_member')
  );

comment on column public.tasks.recommended_role is
  'Suggested team role for this task. Does not assign staff automatically.';

update public.tasks
set recommended_role = case
  when lower(trim(title)) in (
    'review approved scope',
    'confirm sitemap and requirements',
    'collect/confirm client content and assets',
    'prepare staging for client review'
  ) then 'project_manager'
  when lower(trim(title)) in (
    'establish design direction',
    'design homepage',
    'design responsive/mobile layouts'
  ) then 'designer'
  when lower(trim(title)) in (
    'implement responsive layouts',
    'integrate approved content',
    'prepare/deploy staging',
    'build homepage',
    'address requested revisions',
    'deploy production'
  ) then 'developer'
  when lower(trim(title)) in (
    'test staging website',
    'test responsive layouts',
    'verify production website',
    'final qa'
  ) then 'team_member'
  when lower(trim(title)) like 'design %' then 'designer'
  when lower(trim(title)) like 'build %' then 'developer'
  when lower(trim(title)) like 'implement %' then 'developer'
  when lower(trim(title)) like 'add %' then 'developer'
  when lower(trim(title)) like 'set up %' then 'developer'
  when lower(trim(title)) like 'install %' then 'developer'
  when lower(trim(title)) like 'connect the domain' then 'developer'
  when lower(trim(title)) like 'connect %' then 'developer'
  when lower(trim(title)) like 'performance %' then 'developer'
  when lower(trim(title)) like 'security %' then 'developer'
  when lower(trim(title)) like 'test %' then 'team_member'
  when lower(trim(title)) like 'write %' then 'content_writer'
  when lower(trim(title)) like 'migrate %' then 'content_writer'
  else recommended_role
end
where recommended_role is null;

-- Fix: "Collect/confirm client content and assets" is a content-collection task
-- (PM requests content/assets from the client), not a Discovery-workflow task.
-- The prior migration (20260903000000_task_workspace.sql) mistakenly grouped it
-- with the Discovery coordination titles. Additive correction only; does not
-- touch the Discovery workflow, isDiscoveryCoordinationTask, RLS, or storage.

update public.tasks
set task_type = 'content_collection'
where task_type = 'discovery'
  and lower(trim(title)) = 'collect/confirm client content and assets';

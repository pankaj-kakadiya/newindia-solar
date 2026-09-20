-- These security-definer helpers are evaluated by support-chat RLS policies.
-- Signed-in users must be able to invoke them for policy evaluation, while
-- anonymous callers remain blocked from calling the helpers directly.
revoke all on function public.support_is_team_member(uuid, uuid) from public, anon;
revoke all on function public.support_can_access(uuid) from public, anon;

grant execute on function public.support_is_team_member(uuid, uuid) to authenticated;
grant execute on function public.support_can_access(uuid) to authenticated;

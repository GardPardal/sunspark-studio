-- Tighten EXECUTE on SECURITY DEFINER functions
-- Trigger functions: only table owner needs to invoke them
REVOKE ALL ON FUNCTION public.handle_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_leads_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

-- has_role: used inside RLS policies as auth.uid(); only signed-in users need to call
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- admin_list_users: authorization checked inside the function, but restrict to signed-in
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated, service_role;
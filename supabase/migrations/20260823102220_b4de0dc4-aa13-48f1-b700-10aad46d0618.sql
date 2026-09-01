REVOKE EXECUTE ON FUNCTION public.current_actor_role() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_clinician_role() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_actor_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.my_clinician_role() TO service_role;
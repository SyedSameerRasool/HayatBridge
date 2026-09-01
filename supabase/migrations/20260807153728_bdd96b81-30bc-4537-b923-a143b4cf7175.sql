CREATE TABLE public.admin_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  two_factor boolean NOT NULL DEFAULT false,
  email_notifications boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_preferences TO authenticated;
GRANT ALL ON public.admin_preferences TO service_role;
ALTER TABLE public.admin_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own preferences" ON public.admin_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_admin_preferences_updated_at BEFORE UPDATE ON public.admin_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

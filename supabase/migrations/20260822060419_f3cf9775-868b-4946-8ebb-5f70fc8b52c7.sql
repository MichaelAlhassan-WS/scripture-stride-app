CREATE TABLE IF NOT EXISTS public.bootstrap_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.bootstrap_admins TO authenticated;
GRANT ALL ON public.bootstrap_admins TO service_role;
ALTER TABLE public.bootstrap_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bootstrap_admins_admin_read ON public.bootstrap_admins;
CREATE POLICY bootstrap_admins_admin_read ON public.bootstrap_admins
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.bootstrap_admins (email) VALUES ('michaelalhassan216@gmail.com')
  ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;
  IF EXISTS (
    SELECT 1 FROM public.bootstrap_admins b
    WHERE lower(b.email) = lower(COALESCE(NEW.email, ''))
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role FROM public.profiles p
JOIN public.bootstrap_admins b ON lower(b.email) = lower(p.email)
ON CONFLICT (user_id, role) DO NOTHING;

DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
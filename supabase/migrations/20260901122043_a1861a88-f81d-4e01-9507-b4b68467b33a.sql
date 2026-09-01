INSERT INTO public.site_settings (key, value) VALUES
  ('rh:auto_grant_emails', 'paloma.stalen@lz7energia.com.br'),
  ('rh:test_notify_emails', 'alisonlz7@icloud.com')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_rh_role_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_list text;
BEGIN
  SELECT value INTO v_list FROM public.site_settings WHERE key = 'rh:auto_grant_emails';
  IF v_list IS NULL OR NEW.email IS NULL THEN RETURN NEW; END IF;
  IF lower(NEW.email) = ANY (
    SELECT lower(btrim(x)) FROM unnest(string_to_array(v_list, ',')) AS x
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rh'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'active'::public.user_status WHERE id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'grant_rh_role_on_profile falhou para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS grant_rh_role_on_profile ON public.profiles;
CREATE TRIGGER grant_rh_role_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_rh_role_on_profile();
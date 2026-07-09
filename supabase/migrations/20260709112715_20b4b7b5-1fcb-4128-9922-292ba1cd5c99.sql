CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit public.unit_enum;
  v_status public.user_status := 'active';
  v_self boolean := COALESCE((NEW.raw_user_meta_data->>'self_signup')::boolean, false);
  v_token text;
BEGIN
  BEGIN
    v_unit := (NEW.raw_user_meta_data->>'unit')::public.unit_enum;
  EXCEPTION WHEN others THEN v_unit := NULL; END;

  IF v_self THEN v_status := 'pending'; END IF;

  INSERT INTO public.profiles (id, email, full_name, unit, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_unit, v_status)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    unit = COALESCE(public.profiles.unit, EXCLUDED.unit),
    status = CASE WHEN v_self THEN 'pending'::public.user_status ELSE public.profiles.status END;

  IF v_self THEN
    -- Token seguro sem depender de pgcrypto (gen_random_bytes)
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.account_approvals (user_id, email, full_name, requested_unit, token)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_unit, v_token);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia signup por erro no lado do perfil; loga e segue
  RAISE WARNING 'handle_new_user_profile falhou para %: % / %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;
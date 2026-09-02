CREATE OR REPLACE FUNCTION public.wa_sync_portal_message(
  p_org_id uuid,
  p_conversation_id uuid,
  p_contact_id uuid,
  p_direction text,
  p_msg_type text,
  p_body text,
  p_status text,
  p_occurred_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.wa_messages (
    org_id, conversation_id, contact_id, direction, msg_type, body, status, source, occurred_at
  ) VALUES (
    p_org_id, p_conversation_id, p_contact_id, p_direction, p_msg_type, p_body, p_status, 'whatsapp', p_occurred_at
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wa_sync_portal_message(uuid, uuid, uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_sync_portal_message(uuid, uuid, uuid, text, text, text, text, timestamptz) TO service_role;
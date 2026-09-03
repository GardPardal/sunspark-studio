ALTER TABLE public.wa_messages REPLICA IDENTITY FULL;
ALTER TABLE public.wa_conversations REPLICA IDENTITY FULL;

CREATE UNIQUE INDEX IF NOT EXISTS wa_messages_provider_message_id_unique
  ON public.wa_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wa_messages_conversation_occurred_idx
  ON public.wa_messages (conversation_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS wa_conversations_org_last_message_idx
  ON public.wa_conversations (org_id, last_message_at DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_one_open_per_contact_idx
  ON public.wa_conversations (org_id, contact_id)
  WHERE status <> 'encerrada';

CREATE INDEX IF NOT EXISTS wa_events_status_received_idx
  ON public.wa_events (process_status, received_at);

GRANT SELECT, INSERT, UPDATE ON public.wa_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wa_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wa_messages TO authenticated;
GRANT SELECT ON public.wa_channels TO authenticated;
GRANT SELECT, INSERT ON public.wa_consents TO authenticated;
GRANT ALL ON public.wa_contacts, public.wa_conversations, public.wa_messages, public.wa_events, public.wa_channels, public.wa_consents, public.wa_audit_log TO service_role;

ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wa_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wa_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
  END IF;
END $$;
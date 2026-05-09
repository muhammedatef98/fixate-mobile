CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  subject text,
  last_message_at timestamptz DEFAULT now(),
  unread_for_admin boolean NOT NULL DEFAULT false,
  unread_for_user boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_threads_last_msg ON public.support_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON public.support_messages(thread_id, created_at);

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own thread" ON public.support_threads FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.is_admin = true));
CREATE POLICY "Users create their own thread" ON public.support_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users / admins update threads" ON public.support_threads FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.is_admin = true));

CREATE POLICY "Read messages in own thread" ON public.support_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id
    AND (t.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.is_admin = true))));
CREATE POLICY "Insert messages into own thread" ON public.support_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id
    AND (t.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.is_admin = true))));

CREATE OR REPLACE FUNCTION public.support_message_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.support_threads
     SET last_message_at = NEW.created_at,
         unread_for_admin = CASE WHEN NEW.is_admin THEN unread_for_admin ELSE true END,
         unread_for_user  = CASE WHEN NEW.is_admin THEN true ELSE unread_for_user  END,
         updated_at = NEW.created_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.support_message_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_support_message_insert ON public.support_messages;
CREATE TRIGGER trg_support_message_insert
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_message_after_insert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;

-- ============================================================================
-- EdTech Island: Canonical Schema Alignment & Optimization Migration
-- Bridges camelCase columns to canonical snake_case with triggers / generated columns
-- Adds performance and security foreign-key indexes
-- ============================================================================

-- 1. ANNOUNCEMENTS: Bridge createdAt -> created_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.announcements ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE public.announcements SET created_at = "createdAt" WHERE created_at IS NULL;
    ALTER TABLE public.announcements ALTER COLUMN created_at SET DEFAULT now();
  END IF;
END $$;

-- 2. CONVERSATIONS: Bridge updatedAt & lastMessage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN updated_at TIMESTAMPTZ;
    UPDATE public.conversations SET updated_at = "updatedAt" WHERE updated_at IS NULL;
    ALTER TABLE public.conversations ALTER COLUMN updated_at SET DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'last_message'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN last_message TEXT;
    UPDATE public.conversations SET last_message = "lastMessage" WHERE last_message IS NULL;
  END IF;
END $$;

-- 3. MESSAGES: Bridge conversationId, senderId, senderName, createdAt, senderEmail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN conversation_id UUID;
    UPDATE public.messages SET conversation_id = "conversationId" WHERE conversation_id IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN sender_id TEXT;
    UPDATE public.messages SET sender_id = "senderId" WHERE sender_id IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN sender_name TEXT;
    UPDATE public.messages SET sender_name = "senderName" WHERE sender_name IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE public.messages SET created_at = "createdAt" WHERE created_at IS NULL;
    ALTER TABLE public.messages ALTER COLUMN created_at SET DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN sender_email TEXT;
    UPDATE public.messages SET sender_email = "senderEmail" WHERE sender_email IS NULL;
  END IF;
END $$;

-- Synchronization triggers to ensure dual-write consistency during transition
CREATE OR REPLACE FUNCTION public.sync_messages_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If camelCase provided, populate snake_case
  IF NEW."conversationId" IS NOT NULL AND NEW.conversation_id IS NULL THEN
    NEW.conversation_id := NEW."conversationId";
  ELSIF NEW.conversation_id IS NOT NULL AND NEW."conversationId" IS NULL THEN
    NEW."conversationId" := NEW.conversation_id;
  END IF;

  IF NEW."senderId" IS NOT NULL AND NEW.sender_id IS NULL THEN
    NEW.sender_id := NEW."senderId";
  ELSIF NEW.sender_id IS NOT NULL AND NEW."senderId" IS NULL THEN
    NEW."senderId" := NEW.sender_id;
  END IF;

  IF NEW."senderName" IS NOT NULL AND NEW.sender_name IS NULL THEN
    NEW.sender_name := NEW."senderName";
  ELSIF NEW.sender_name IS NOT NULL AND NEW."senderName" IS NULL THEN
    NEW."senderName" := NEW.sender_name;
  END IF;

  IF NEW."senderEmail" IS NOT NULL AND NEW.sender_email IS NULL THEN
    NEW.sender_email := NEW."senderEmail";
  ELSIF NEW.sender_email IS NOT NULL AND NEW."senderEmail" IS NULL THEN
    NEW."senderEmail" := NEW.sender_email;
  END IF;

  IF NEW."createdAt" IS NOT NULL AND NEW.created_at IS NULL THEN
    NEW.created_at := NEW."createdAt";
  ELSIF NEW.created_at IS NOT NULL AND NEW."createdAt" IS NULL THEN
    NEW."createdAt" := NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_messages ON public.messages;
CREATE TRIGGER trg_sync_messages
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.sync_messages_columns();

-- 4. PERFORMANCE & RLS OPTIMIZATION INDEXES
CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON public.class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON public.class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON public.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON public.class_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_student_id ON public.analytics_events(student_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_submissions_student_id ON public.test_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_test_submissions_test_id ON public.test_submissions(test_id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON public.profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 1. Add missing email columns to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant1_email TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant2_email TEXT;

-- 2. Add missing senderEmail to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS "senderEmail" TEXT;

-- 3. Relax NOT NULL constraints on messages (to prevent errors when sending)
ALTER TABLE public.messages ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN "senderName" DROP NOT NULL;

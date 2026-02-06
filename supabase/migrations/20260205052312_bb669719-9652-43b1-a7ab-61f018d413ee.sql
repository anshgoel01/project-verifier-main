-- Add column to track if completion email was sent
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completion_email_sent BOOLEAN DEFAULT false;
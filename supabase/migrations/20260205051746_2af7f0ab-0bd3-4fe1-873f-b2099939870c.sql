-- Create submissions table to store verification results for each job
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.jobs(job_id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  coursera_link TEXT,
  linkedin_link TEXT,
  coursera_link_duplicate BOOLEAN DEFAULT false,
  linkedin_link_duplicate BOOLEAN DEFAULT false,
  student_match_auto TEXT DEFAULT 'Pending',
  course_match_auto TEXT DEFAULT 'Pending',
  student_match_reason TEXT,
  course_match_reason TEXT,
  admin_student_verification TEXT DEFAULT 'Not Reviewed',
  admin_course_verification TEXT DEFAULT 'Not Reviewed',
  final_decision TEXT DEFAULT 'Pending',
  admin_override TEXT,
  scraped_coursera_name TEXT,
  scraped_coursera_project TEXT,
  scraped_linkedin_name TEXT,
  scraped_linkedin_text TEXT,
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (matching jobs table pattern)
CREATE POLICY "Anyone can view submissions by job_id"
  ON public.submissions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update submissions"
  ON public.submissions FOR UPDATE
  USING (true);

-- Create index for faster job_id lookups
CREATE INDEX idx_submissions_job_id ON public.submissions(job_id);

-- Add trigger for updated_at
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for submissions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
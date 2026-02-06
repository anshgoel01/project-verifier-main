-- Create jobs table to track verification jobs
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Processing', 'Completed', 'Failed')),
  file_name TEXT,
  total_submissions INTEGER DEFAULT 0,
  completed_submissions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone can view job status with job_id)
CREATE POLICY "Anyone can view jobs by job_id"
ON public.jobs
FOR SELECT
USING (true);

-- Create policy for public insert (anyone can create jobs)
CREATE POLICY "Anyone can create jobs"
ON public.jobs
FOR INSERT
WITH CHECK (true);

-- Create policy for public update (for updating job status)
CREATE POLICY "Anyone can update job status"
ON public.jobs
FOR UPDATE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
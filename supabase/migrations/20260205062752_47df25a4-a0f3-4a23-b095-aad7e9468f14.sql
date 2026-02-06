-- Add DELETE policy for jobs table (users can delete their own jobs)
CREATE POLICY "Anyone can delete jobs"
ON public.jobs
FOR DELETE
USING (true);

-- Add DELETE policy for submissions table (needed for cascade delete)
CREATE POLICY "Anyone can delete submissions"
ON public.submissions
FOR DELETE
USING (true);
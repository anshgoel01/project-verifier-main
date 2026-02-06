import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, Loader2, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
 import { SubmissionsTable, type Submission } from '@/components/SubmissionsTable';
 import { DownloadButtons } from '@/components/DownloadButtons';

interface Job {
  id: string;
  job_id: string;
  user_email: string;
  status: string;
  file_name: string;
  total_submissions: number;
  completed_submissions: number;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, {
  icon: typeof Clock;
  color: string;
  bgColor: string;
  description: string;
  animate?: boolean;
}> = {
  Queued: {
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    description: 'Your job is waiting in the queue to be processed.',
  },
  Processing: {
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: 'Your submissions are currently being verified.',
    animate: true,
  },
  Completed: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    description: 'All submissions have been verified successfully.',
  },
  Failed: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    description: 'An error occurred while processing your job.',
  },
};

const JobStatus = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('id');
  
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
   const [submissions, setSubmissions] = useState<Submission[]>([]);

  const fetchJob = async () => {
    if (!jobId) {
      setError('No job ID provided');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Job not found');
        } else {
          setError(fetchError.message);
        }
      } else {
        setJob(data);
        setError(null);
         
         // Fetch submissions for this job
         const { data: submissionsData } = await supabase
           .from('submissions')
           .select('*')
           .eq('job_id', jobId)
           .order('created_at', { ascending: true });
         
         if (submissionsData) {
           setSubmissions(submissionsData as Submission[]);
         }
      }
    } catch (err) {
      setError('Failed to fetch job status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();

    // Set up realtime subscription
    const channel = supabase
      .channel('job-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as Job);
        }
      )
      .subscribe();

     // Subscribe to submissions changes
     const submissionsChannel = supabase
       .channel('job-submissions')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'submissions',
           filter: `job_id=eq.${jobId}`,
         },
         () => {
           // Refetch submissions on any change
           supabase
             .from('submissions')
             .select('*')
             .eq('job_id', jobId)
             .order('created_at', { ascending: true })
             .then(({ data }) => {
               if (data) setSubmissions(data as Submission[]);
             });
         }
       )
       .subscribe();
 
    return () => {
      supabase.removeChannel(channel);
       supabase.removeChannel(submissionsChannel);
    };
  }, [jobId]);

  const progress = job 
    ? (job.total_submissions > 0 ? (job.completed_submissions / job.total_submissions) * 100 : 0)
    : 0;

  const config = job ? statusConfig[job.status as keyof typeof statusConfig] : null;
  const StatusIcon = config?.icon || Clock;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </Button>

        <div className="max-w-2xl mx-auto">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Loading job status...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="w-12 h-12 mx-auto text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">{error}</h2>
                <p className="mt-2 text-muted-foreground">
                  Please check your job ID and try again.
                </p>
                <Button onClick={() => navigate('/')} className="mt-6">
                  Go to Upload Page
                </Button>
              </CardContent>
            </Card>
          ) : job ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Job Status</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchJob}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Job ID</p>
                    <p className="text-2xl font-mono font-bold text-primary">
                      {job.job_id}
                    </p>
                  </div>

                  <div className={`flex items-center justify-center gap-3 p-4 rounded-lg ${config?.bgColor}`}>
                    <StatusIcon className={`w-6 h-6 ${config?.color} ${config?.animate ? 'animate-spin' : ''}`} />
                    <span className={`text-lg font-semibold ${config?.color}`}>
                      {job.status}
                    </span>
                  </div>

                  <p className="text-center text-muted-foreground mt-4">
                    {config?.description}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress value={progress} className="h-3" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {job.completed_submissions} of {job.total_submissions} submissions verified
                      </span>
                      <span className="font-semibold">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Job Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">File Name</dt>
                      <dd className="font-medium">{job.file_name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Email</dt>
                      <dd className="font-medium">{job.user_email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Created</dt>
                      <dd className="font-medium">
                        {new Date(job.created_at).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Last Updated</dt>
                      <dd className="font-medium">
                        {new Date(job.updated_at).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {job.status === 'Completed' && (
                 <>
                  {submissions.length > 0 && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>Download Results</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <DownloadButtons submissions={submissions} jobId={job.job_id} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Verification Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <SubmissionsTable submissions={submissions} />
                        </CardContent>
                      </Card>
                    </>
                  )}
                 </>
               )}

              {(job.status === 'Processing' || job.status === 'Queued') && (
                 <Card>
                   <CardHeader>
                    <CardTitle>Processing in Progress</CardTitle>
                   </CardHeader>
                   <CardContent>
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                      <p className="text-muted-foreground">
                        Verifying submissions in batches...
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Processed {job.completed_submissions} of {job.total_submissions} submissions
                      </p>
                      <p className="text-xs text-muted-foreground mt-4">
                        Detailed results will be available once processing completes.
                      </p>
                    </div>
                   </CardContent>
                 </Card>
               )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default JobStatus;

import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { Navbar } from '@/components/Navbar';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, ArrowLeft, Eye, XCircle, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { JobStatusBadge } from '@/components/JobStatusBadge';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Job {
  id: string;
  job_id: string;
  file_name: string | null;
  created_at: string;
  status: string;
  total_submissions: number | null;
  completed_submissions: number | null;
  user_email: string;
}
 
 const TrackJob = () => {
   const navigate = useNavigate();
   const [jobId, setJobId] = useState('');
  const [email, setEmail] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (jobId.trim()) {
       navigate(`/job-status?id=${encodeURIComponent(jobId.trim())}`);
     }
   };
 
  const fetchJobsByEmail = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email to view your jobs.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_email', email.trim().toLowerCase())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch jobs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (job: Job) => {
    if (job.status !== 'Queued' && job.status !== 'Processing') return;

    setActionLoading(job.job_id);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'Cancelled' })
        .eq('job_id', job.job_id);

      if (error) throw error;

      setJobs(prev => prev.map(j => 
        j.job_id === job.job_id ? { ...j, status: 'Cancelled' } : j
      ));

      toast({
        title: 'Job Cancelled',
        description: `Job ${job.job_id} has been cancelled successfully.`,
      });
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel job. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;

    setActionLoading(deleteJobId);
    try {
      // Delete submissions first (due to foreign key)
      await supabase
        .from('submissions')
        .delete()
        .eq('job_id', deleteJobId);

      // Then delete the job
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('job_id', deleteJobId);

      if (error) throw error;

      setJobs(prev => prev.filter(j => j.job_id !== deleteJobId));

      toast({
        title: 'Job Deleted',
        description: `Job ${deleteJobId} has been permanently deleted.`,
      });
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete job. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
      setDeleteJobId(null);
    }
  };

  const canCancel = (status: string) => status === 'Queued' || status === 'Processing';

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
 
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Email-based job lookup */}
          <Card>
            <CardHeader>
              <CardTitle>My Jobs</CardTitle>
              <CardDescription>
                Enter your email to view all your submitted verification jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchJobsByEmail()}
                  className="flex-1"
                />
                <Button onClick={fetchJobsByEmail} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Find Jobs</span>
                </Button>
                {hasSearched && (
                  <Button variant="outline" onClick={fetchJobsByEmail} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Job list table */}
          {hasSearched && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Jobs ({jobs.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No jobs found for this email address.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job ID</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-mono text-sm">
                              {job.job_id}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {job.file_name || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(job.created_at).toLocaleDateString()}{' '}
                              {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <JobStatusBadge status={job.status} />
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {job.completed_submissions ?? 0} / {job.total_submissions ?? 0}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/job-status?id=${job.job_id}`)}
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelJob(job)}
                                  disabled={!canCancel(job.status) || actionLoading === job.job_id}
                                  title={canCancel(job.status) ? 'Cancel job' : 'Cannot cancel'}
                                  className="text-warning hover:text-warning"
                                >
                                  {actionLoading === job.job_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteJobId(job.job_id)}
                                  disabled={actionLoading === job.job_id}
                                  title="Delete job"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job ID direct lookup */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Quick Job Lookup</CardTitle>
              <CardDescription>
                Or enter a Job ID directly to view its status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter Job ID (e.g., JOB-20260205-XXXX)"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="flex-1 font-mono"
                />
                <Button type="submit" disabled={!jobId.trim()}>
                  <Search className="w-4 h-4 mr-2" />
                  View
                </Button>
              </form>
            </CardContent>
          </Card>
         </div>
       </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete job <span className="font-mono font-semibold">{deleteJobId}</span> and all its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJob}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
     </div>
   );
 };
 
 export default TrackJob;
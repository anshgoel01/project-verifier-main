 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
// ============================================
// CONFIGURATION
// ============================================
const BATCH_SIZE = 10;          // Rows processed concurrently per batch
const ROW_TIMEOUT_MS = 12000;   // 12 seconds HARD timeout per row
const BATCH_DELAY_MS = 250;     // Delay between batches to avoid rate limiting
const JOB_WATCHDOG_MS = 30 * 60 * 1000; // 30 minutes max job runtime

 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface ProcessJobRequest {
   jobId: string;
 }
 
 interface VerificationResult {
   studentMatchAuto: string;
   courseMatchAuto: string;
   studentMatchReason: string;
   courseMatchReason: string;
   scrapedCourseraName: string;
   scrapedCourseraProject: string;
   scrapedLinkedinName: string;
   scrapedLinkedinText: string;
   error?: string;
 }
 
interface SubmissionRow {
  id: string;
  student_name: string;
  coursera_link: string | null;
  linkedin_link: string | null;
}

// Result type for tracking processing outcomes
interface ProcessResult {
  submissionId: string;
  status: "completed" | "failed" | "timeout";
  error?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/** Splits an array into chunks of specified size */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Wraps a promise with a HARD timeout - rejects on timeout (never hangs) */
function withHardTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("ROW_TIMEOUT"));
    }, ms);
    
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/** Determine final job status based on processing results */
function determineJobStatus(failedCount: number, isPartial: boolean = false): string {
  if (isPartial) {
    return "Completed (Partial)";
  }
  if (failedCount > 0) {
    return "Completed with Errors";
  }
  return "Completed";
}

// ============================================
// SUBMISSION PROCESSING
// ============================================

/** Process a single submission row with duplicate detection and verification */
async function processSubmission(
  supabase: any,
  submission: SubmissionRow,
  jobId: string,
  verifyUrl: string,
  supabaseKey: string
): Promise<ProcessResult> {
  try {
    // Check for duplicate links first
    let courseraLinkDuplicate = false;
    let linkedinLinkDuplicate = false;

    if (submission.coursera_link) {
      const { count } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("coursera_link", submission.coursera_link)
        .neq("id", submission.id);
      
      courseraLinkDuplicate = (count || 0) > 0;
    }

    if (submission.linkedin_link) {
      const { count } = await supabase
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("linkedin_link", submission.linkedin_link)
        .neq("id", submission.id);
      
      linkedinLinkDuplicate = (count || 0) > 0;
    }

    // Call verify-submission edge function with AbortController for fetch timeout
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), ROW_TIMEOUT_MS - 2000);
    
    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        studentName: submission.student_name,
        courseraLink: submission.coursera_link,
        linkedinLink: submission.linkedin_link,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(fetchTimeout);

    const result: VerificationResult = await verifyResponse.json();

    // Determine final decision
    let finalDecision = "Pending";
    if (courseraLinkDuplicate || linkedinLinkDuplicate) {
      finalDecision = "Wrong";
    } else if (result.studentMatchAuto === "Yes" && result.courseMatchAuto === "Yes") {
      finalDecision = "Correct";
    } else if (result.studentMatchAuto === "No" || result.courseMatchAuto === "No") {
      finalDecision = "Wrong";
    }

    // Update submission with results
    await supabase
      .from("submissions")
      .update({
        processing_status: "completed",
        student_match_auto: result.studentMatchAuto,
        course_match_auto: result.courseMatchAuto,
        student_match_reason: result.studentMatchReason,
        course_match_reason: result.courseMatchReason,
        scraped_coursera_name: result.scrapedCourseraName,
        scraped_coursera_project: result.scrapedCourseraProject,
        scraped_linkedin_name: result.scrapedLinkedinName,
        scraped_linkedin_text: result.scrapedLinkedinText,
        coursera_link_duplicate: courseraLinkDuplicate,
        linkedin_link_duplicate: linkedinLinkDuplicate,
        final_decision: finalDecision,
        error_message: result.error || null,
      })
      .eq("id", submission.id);

    return { submissionId: submission.id, status: "completed" };
  } catch (error) {
    console.error(`Error processing submission ${submission.id}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = errorMessage === "ROW_TIMEOUT" || errorMessage.includes("abort");
    
    // Mark as failed
    await supabase
      .from("submissions")
      .update({
        processing_status: "failed",
        error_message: isTimeout ? `Skipped (Timeout after ${ROW_TIMEOUT_MS / 1000}s)` : errorMessage,
        student_match_auto: "No",
        course_match_auto: "No",
        final_decision: "Wrong",
      })
      .eq("id", submission.id);

    return { 
      submissionId: submission.id, 
      status: isTimeout ? "timeout" : "failed", 
      error: errorMessage
    };
  }
}

// ============================================
// JOB PROCESSOR (Background Task)
// ============================================

interface JobProcessorParams {
  jobId: string;
  supabaseUrl: string;
  supabaseKey: string;
}

/** Main job processor - runs as background task */
async function processJobBackground(params: JobProcessorParams): Promise<void> {
  const { jobId, supabaseUrl, supabaseKey } = params;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const verifyUrl = `${supabaseUrl}/functions/v1/verify-submission`;
  
  const jobStartTime = Date.now();
  let isPartialCompletion = false;
  let processedBatches = 0;
  
  console.log(`[JOB ${jobId}] Background processor started`);
  
  try {
    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("job_id", jobId)
      .single();

    if (jobError || !job) {
      console.error(`[JOB ${jobId}] Job not found:`, jobError);
      return;
    }

    console.log(`[JOB ${jobId}] Found job with ${job.total_submissions} total submissions`);

    // Get all pending submissions for this job
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("*")
      .eq("job_id", jobId)
      .eq("processing_status", "pending")
      .order("created_at", { ascending: true });

    if (submissionsError) {
      console.error(`[JOB ${jobId}] Error fetching submissions:`, submissionsError);
      return;
    }

    if (!submissions || submissions.length === 0) {
      console.log(`[JOB ${jobId}] No pending submissions, finalizing...`);
      await finalizeJob(supabase, supabaseUrl, supabaseKey, jobId, job.total_submissions, false);
      return;
    }

    console.log(`[JOB ${jobId}] Processing ${submissions.length} pending submissions`);

    // Process in batches
    const batches = chunkArray(submissions as SubmissionRow[], BATCH_SIZE);
    let completedCount = job.completed_submissions || 0;

    console.log(`[JOB ${jobId}] Split into ${batches.length} batches of ${BATCH_SIZE}`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // WATCHDOG: Check if job exceeded max runtime
      const elapsed = Date.now() - jobStartTime;
      if (elapsed > JOB_WATCHDOG_MS) {
        console.warn(`[JOB ${jobId}] WATCHDOG: Job exceeded ${JOB_WATCHDOG_MS / 60000} minutes, forcing partial completion`);
        isPartialCompletion = true;
        break;
      }

      // Check for cancellation
      const { data: currentJob } = await supabase
        .from("jobs")
        .select("status")
        .eq("job_id", jobId)
        .single();

      if (currentJob?.status === "Cancelled") {
        console.log(`[JOB ${jobId}] Cancelled by user, stopping`);
        return; // Don't finalize cancelled jobs
      }

      const batch = batches[batchIndex];
      const batchNum = batchIndex + 1;
      console.log(`[JOB ${jobId}] Batch ${batchNum}/${batches.length} starting (${batch.length} rows)`);

      // Mark batch as processing
      const batchIds = batch.map(s => s.id);
      await supabase
        .from("submissions")
        .update({ processing_status: "processing" })
        .in("id", batchIds);

      // Process all rows in batch with HARD timeout using Promise.allSettled
      const batchPromises = batch.map(async (submission): Promise<ProcessResult> => {
        try {
          return await withHardTimeout(
            processSubmission(supabase, submission, jobId, verifyUrl, supabaseKey),
            ROW_TIMEOUT_MS
          );
        } catch (error) {
          // Timeout or error - mark row as failed
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          const isTimeout = errorMsg === "ROW_TIMEOUT";
          
          console.warn(`[JOB ${jobId}] Row ${submission.id} ${isTimeout ? 'timed out' : 'failed'}: ${errorMsg}`);
          
          await supabase
            .from("submissions")
            .update({
              processing_status: "failed",
              error_message: isTimeout ? `Skipped (Timeout after ${ROW_TIMEOUT_MS / 1000}s)` : errorMsg,
              student_match_auto: "No",
              course_match_auto: "No",
              final_decision: "Wrong",
            })
            .eq("id", submission.id);
          
          return { submissionId: submission.id, status: isTimeout ? "timeout" : "failed", error: errorMsg };
        }
      });

      // Wait for ALL rows - allSettled NEVER rejects
      const results = await Promise.allSettled(batchPromises);
      
      // Count results
      const stats = { completed: 0, failed: 0, timeout: 0 };
      for (const r of results) {
        if (r.status === "fulfilled") {
          stats[r.value.status as keyof typeof stats]++;
        } else {
          stats.failed++;
        }
      }
      
      console.log(`[JOB ${jobId}] Batch ${batchNum} done: ${JSON.stringify(stats)}`);

      // ATOMIC progress update - always increment by batch size
      completedCount += batch.length;
      await supabase
        .from("jobs")
        .update({ completed_submissions: completedCount })
        .eq("job_id", jobId);

      console.log(`[JOB ${jobId}] Progress: ${completedCount}/${job.total_submissions}`);
      processedBatches++;

      // Rate limit delay between batches
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Finalize job (always runs)
    await finalizeJob(supabase, supabaseUrl, supabaseKey, jobId, job.total_submissions, isPartialCompletion);

  } catch (error) {
    console.error(`[JOB ${jobId}] Fatal error in processor:`, error);
    
    // Force finalize even on error
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from("jobs")
        .update({ status: "Failed" })
        .eq("job_id", jobId);
      
      await triggerCompletionEmail(supabaseUrl, supabaseKey, jobId);
    } catch (finalizeError) {
      console.error(`[JOB ${jobId}] Failed to finalize after error:`, finalizeError);
    }
  }
}

/** Finalize job - ALWAYS runs via try/finally pattern */
async function finalizeJob(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  jobId: string,
  totalSubmissions: number,
  isPartial: boolean
): Promise<void> {
  console.log(`[JOB ${jobId}] Finalizing (partial: ${isPartial})`);
  
  try {
    // Check if cancelled
    const { data: currentJob } = await supabase
      .from("jobs")
      .select("status")
      .eq("job_id", jobId)
      .single();

    if (currentJob?.status === "Cancelled") {
      console.log(`[JOB ${jobId}] Skipping finalization - job was cancelled`);
      return;
    }

    // Count final statistics
    const { count: totalCompleted } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .in("processing_status", ["completed", "failed"]);

    const { count: failedCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("processing_status", "failed");

    console.log(`[JOB ${jobId}] Final stats: ${totalCompleted}/${totalSubmissions} processed, ${failedCount} failed`);

    // Determine and set final status
    const finalStatus = determineJobStatus(failedCount || 0, isPartial);
    console.log(`[JOB ${jobId}] Setting final status: ${finalStatus}`);

    await supabase
      .from("jobs")
      .update({ 
        status: finalStatus, 
        completed_submissions: totalCompleted 
      })
      .eq("job_id", jobId);

    // ALWAYS send completion email
    await triggerCompletionEmail(supabaseUrl, supabaseKey, jobId);
    
    console.log(`[JOB ${jobId}] Finalization complete`);
  } catch (error) {
    console.error(`[JOB ${jobId}] Error during finalization:`, error);
    
    // Last resort - try to mark as failed
    try {
      await supabase
        .from("jobs")
        .update({ status: "Failed" })
        .eq("job_id", jobId);
    } catch (e) {
      console.error(`[JOB ${jobId}] Could not even mark as failed:`, e);
    }
  }
}

// ============================================
// HTTP HANDLER (Returns immediately, processes in background)
// ============================================

const handler = async (req: Request): Promise<Response> => {
  console.log("process-job function invoked");
 
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
 
  try {
    const { jobId }: ProcessJobRequest = await req.json();
    console.log("Received job:", jobId);
 
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Missing jobId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
 
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
 
    // Verify job exists
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("job_id, status")
      .eq("job_id", jobId)
      .single();
 
    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
 
    console.log("Job found:", job.job_id, "Status:", job.status);
 
    // Start background processing - returns immediately
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processJobBackground({ jobId, supabaseUrl, supabaseKey })
    );
 
    // Return immediately - processing continues in background
    return new Response(
      JSON.stringify({ success: true, message: "Job processing started in background" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
 
  } catch (error) {
    console.error("Error in process-job function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};
 
async function triggerCompletionEmail(supabaseUrl: string, supabaseKey: string, jobId: string) {
  try {
    console.log(`[EMAIL] Triggering completion email for job ${jobId}`);
    const emailUrl = `${supabaseUrl}/functions/v1/send-completion-email`;
    const response = await fetch(emailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ jobId }),
    });
    const result = await response.text();
    console.log(`[EMAIL] Result for job ${jobId}:`, result);
  } catch (error) {
    console.error(`[EMAIL] Error for job ${jobId}:`, error);
  }
}
 
// Shutdown handler for graceful cleanup
addEventListener('beforeunload', (ev: Event) => {
  // @ts-ignore - detail is available on shutdown events
  const reason = (ev as any).detail?.reason || 'unknown';
  console.log(`[SHUTDOWN] Function shutting down: ${reason}`);
});

serve(handler);
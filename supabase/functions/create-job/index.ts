import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SubmissionRow {
  rollNumber: string;
  studentName: string;
  courseraLink: string;
  linkedinLink: string;
}

interface CreateJobRequest {
  email: string;
  fileName: string;
  totalSubmissions: number;
  submissions: SubmissionRow[];
}

function generateJobId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JOB-${dateStr}-${randomPart}`;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("create-job function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, fileName, totalSubmissions, submissions }: CreateJobRequest = await req.json();
    console.log("Request data:", { email, fileName, totalSubmissions });
    console.log("Submissions count:", submissions?.length || 0);

    // Validate required fields
    if (!email || !fileName || !submissions || submissions.length === 0) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, fileName, and submissions" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate unique job ID
    const jobId = generateJobId();
    console.log("Generated job ID:", jobId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert job into database
    const { data: jobData, error: dbError } = await supabase
      .from("jobs")
      .insert({
        job_id: jobId,
        user_email: email,
        file_name: fileName,
        total_submissions: totalSubmissions,
        status: "Queued",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to create job", details: dbError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Job created in database:", jobData);

    // Insert all submissions into the submissions table
    const submissionInserts = submissions.map((sub) => ({
      job_id: jobId,
      roll_number: sub.rollNumber,
      student_name: sub.studentName,
      coursera_link: sub.courseraLink,
      linkedin_link: sub.linkedinLink,
      processing_status: "pending",
      student_match_auto: "Pending",
      course_match_auto: "Pending",
      final_decision: "Pending",
    }));

    const { error: submissionsError } = await supabase
      .from("submissions")
      .insert(submissionInserts);

    if (submissionsError) {
      console.error("Error inserting submissions:", submissionsError);
      // Delete the job since submissions failed
      await supabase.from("jobs").delete().eq("job_id", jobId);
      return new Response(
        JSON.stringify({ error: "Failed to create submissions", details: submissionsError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Submissions inserted:", submissionInserts.length);

    // Update job status to Processing immediately
    await supabase
      .from("jobs")
      .update({ status: "Processing" })
      .eq("job_id", jobId);

    console.log("Job status updated to Processing");

    // Trigger background processing using waitUntil
    const processJobUrl = `${supabaseUrl}/functions/v1/process-job`;
    
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          console.log("Triggering background job processing for:", jobId);
          const response = await fetch(processJobUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ jobId }),
          });
          const result = await response.text();
          console.log("Process-job invocation result:", result);
        } catch (error) {
          console.error("Error triggering process-job:", error);
        }
      })()
    );

    // Send email notification
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        const emailResponse = await resend.emails.send({
          from: "Student Verification Portal <onboarding@resend.dev>",
          to: [email],
          subject: `Job ${jobId} - Verification Request Accepted`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
                .job-id { font-size: 24px; font-weight: bold; color: #2563eb; background: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                .status { display: inline-block; background: #fef3c7; color: #92400e; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
                .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Student Verification Portal</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>Your verification job has been successfully accepted and is now being processed.</p>
                  
                  <div class="job-id">
                    ${jobId}
                  </div>
                  
                  <p><strong>Job Details:</strong></p>
                  <ul>
                    <li><strong>File:</strong> ${fileName}</li>
                    <li><strong>Total Submissions:</strong> ${totalSubmissions}</li>
                    <li><strong>Status:</strong> <span class="status">Processing</span></li>
                  </ul>
                  
                  <p>You can track the progress of your verification job using the Job ID above.</p>
                  
                  <p>We will process your submissions and verify each student's Coursera certificate and LinkedIn post.</p>
                  
                  <div class="footer">
                    <p>This is an automated message from the Student Verification Portal.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        
        console.log("Email sent successfully:", emailResponse);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Don't fail the job creation if email fails
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping email notification");
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId: jobId,
        message: "Job created successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in create-job function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

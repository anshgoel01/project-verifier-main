 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import { Resend } from "https://esm.sh/resend@2.0.0";
 import * as XLSX from "https://esm.sh/xlsx@0.18.5";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface SendCompletionEmailRequest {
   jobId: string;
 }
 
 interface Submission {
   id: string;
   roll_number: string;
   student_name: string;
   coursera_link: string | null;
   linkedin_link: string | null;
   student_match_auto: string;
   course_match_auto: string;
   student_match_reason: string | null;
   course_match_reason: string | null;
   final_decision: string;
   processing_status: string;
 }
 
 function generateExcelBuffer(submissions: Submission[], type: 'all' | 'correct' | 'wrong'): Uint8Array {
   let data = submissions;
   
   if (type === 'correct') {
     data = submissions.filter(s => s.final_decision === 'Correct');
   } else if (type === 'wrong') {
     data = submissions.filter(s => s.final_decision === 'Wrong');
   }
 
   const exportData = data.map(s => ({
     'Roll Number': s.roll_number,
     'Student Name': s.student_name,
     'Coursera Link': s.coursera_link || '',
     'LinkedIn Link': s.linkedin_link || '',
     'Student Match': s.student_match_auto,
     'Student Match Reason': s.student_match_reason || '',
     'Course Match': s.course_match_auto,
     'Course Match Reason': s.course_match_reason || '',
     'Final Decision': s.final_decision,
     'Processing Status': s.processing_status,
   }));
 
   const ws = XLSX.utils.json_to_sheet(exportData);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, 'Results');
   
   const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
   return new Uint8Array(buffer);
 }
 
interface StudentSummary {
  rollNumber: string;
  studentName: string;
  totalSubmissions: number;
  rightSubmissions: number;
  wrongSubmissions: number;
  marks: number;
}

function generateSummaryExcelBuffer(submissions: Submission[]): Uint8Array {
  // Aggregate submissions by roll number
  const summaryMap = new Map<string, StudentSummary>();

  submissions.forEach(s => {
    const existing = summaryMap.get(s.roll_number);
    const isCorrect = s.final_decision === 'Correct';
    const isWrong = s.final_decision === 'Wrong';

    if (existing) {
      existing.totalSubmissions++;
      if (isCorrect) existing.rightSubmissions++;
      if (isWrong) existing.wrongSubmissions++;
      existing.marks = existing.rightSubmissions; // 1 mark per correct
    } else {
      summaryMap.set(s.roll_number, {
        rollNumber: s.roll_number,
        studentName: s.student_name,
        totalSubmissions: 1,
        rightSubmissions: isCorrect ? 1 : 0,
        wrongSubmissions: isWrong ? 1 : 0,
        marks: isCorrect ? 1 : 0,
      });
    }
  });

  const summaryData = Array.from(summaryMap.values()).map(s => ({
    'Roll Number': s.rollNumber,
    'Student Name': s.studentName,
    'Total Submissions': s.totalSubmissions,
    'Right Submissions': s.rightSubmissions,
    'Wrong Submissions': s.wrongSubmissions,
    'Marks': s.marks,
  }));

  // Sort by roll number
  summaryData.sort((a, b) => a['Roll Number'].localeCompare(b['Roll Number']));

  const ws = XLSX.utils.json_to_sheet(summaryData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

 function uint8ArrayToBase64(uint8Array: Uint8Array): string {
   let binary = '';
   const len = uint8Array.byteLength;
   for (let i = 0; i < len; i++) {
     binary += String.fromCharCode(uint8Array[i]);
   }
   return btoa(binary);
 }
 
 const handler = async (req: Request): Promise<Response> => {
   console.log("send-completion-email function invoked");
 
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const { jobId }: SendCompletionEmailRequest = await req.json();
     console.log("Processing completion email for job:", jobId);
 
     if (!jobId) {
       return new Response(
         JSON.stringify({ error: "Missing required field: jobId" }),
         { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     // Fetch job details
     const { data: job, error: jobError } = await supabase
       .from("jobs")
       .select("*")
       .eq("job_id", jobId)
       .single();
 
     if (jobError || !job) {
       console.error("Job not found:", jobError);
       return new Response(
         JSON.stringify({ error: "Job not found" }),
         { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     // Check if email already sent
     if (job.completion_email_sent) {
       console.log("Completion email already sent for job:", jobId);
       return new Response(
         JSON.stringify({ success: true, message: "Email already sent" }),
         { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     // Check if job is completed
     if (job.status !== "Completed") {
       console.log("Job not completed yet:", job.status);
       return new Response(
         JSON.stringify({ error: "Job not completed yet", status: job.status }),
         { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     // Fetch all submissions for this job
     const { data: submissions, error: submissionsError } = await supabase
       .from("submissions")
       .select("*")
       .eq("job_id", jobId)
       .order("created_at", { ascending: true });
 
     if (submissionsError) {
       console.error("Error fetching submissions:", submissionsError);
       return new Response(
         JSON.stringify({ error: "Failed to fetch submissions" }),
         { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     console.log(`Found ${submissions?.length || 0} submissions for job ${jobId}`);
 
     // Calculate summary statistics
     const totalSubmissions = submissions?.length || 0;
     const correctCount = submissions?.filter(s => s.final_decision === 'Correct').length || 0;
     const wrongCount = submissions?.filter(s => s.final_decision === 'Wrong').length || 0;
     const pendingCount = submissions?.filter(s => s.final_decision === 'Pending').length || 0;
 
     // Generate Excel files
     const allResultsBuffer = generateExcelBuffer(submissions || [], 'all');
     const correctResultsBuffer = generateExcelBuffer(submissions || [], 'correct');
     const wrongResultsBuffer = generateExcelBuffer(submissions || [], 'wrong');
      const summaryBuffer = generateSummaryExcelBuffer(submissions || []);
 
     // Convert to base64 for email attachments
     const allResultsBase64 = uint8ArrayToBase64(allResultsBuffer);
     const correctResultsBase64 = uint8ArrayToBase64(correctResultsBuffer);
     const wrongResultsBase64 = uint8ArrayToBase64(wrongResultsBuffer);
      const summaryBase64 = uint8ArrayToBase64(summaryBuffer);

      // Count unique students
      const uniqueStudents = new Set((submissions || []).map(s => s.roll_number)).size;
 
     const resendApiKey = Deno.env.get("RESEND_API_KEY");
     if (!resendApiKey) {
       console.error("RESEND_API_KEY not configured");
       return new Response(
         JSON.stringify({ error: "Email service not configured" }),
         { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     const resend = new Resend(resendApiKey);
 
     // Build attachments array
     const attachments = [
       {
         filename: `${jobId}-all-results.xlsx`,
         content: allResultsBase64,
       },
        {
          filename: `${jobId}-student-summary.xlsx`,
          content: summaryBase64,
        },
     ];
 
     if (correctCount > 0) {
       attachments.push({
         filename: `${jobId}-correct-results.xlsx`,
         content: correctResultsBase64,
       });
     }
 
     if (wrongCount > 0) {
       attachments.push({
         filename: `${jobId}-wrong-results.xlsx`,
         content: wrongResultsBase64,
       });
     }
 
     const emailResponse = await resend.emails.send({
       from: "Student Verification Portal <onboarding@resend.dev>",
       to: [job.user_email],
       subject: `✅ Verification Complete - Job ${jobId}`,
       html: `
         <!DOCTYPE html>
         <html>
         <head>
           <style>
             body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
             .container { max-width: 600px; margin: 0 auto; padding: 20px; }
             .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
             .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
             .job-id { font-size: 24px; font-weight: bold; color: #16a34a; background: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
             .stats { display: flex; justify-content: space-around; margin: 20px 0; }
             .stat { text-align: center; padding: 15px; background: white; border-radius: 8px; min-width: 80px; }
             .stat-number { font-size: 28px; font-weight: bold; }
             .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
             .correct { color: #16a34a; }
             .wrong { color: #dc2626; }
             .pending { color: #f59e0b; }
             .total { color: #2563eb; }
             .attachments { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
             .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
           </style>
         </head>
         <body>
           <div class="container">
             <div class="header">
               <h1>✅ Verification Complete!</h1>
             </div>
             <div class="content">
               <p>Hello,</p>
               <p>Great news! Your verification job has been completed successfully.</p>
               
               <div class="job-id">
                 ${jobId}
               </div>
               
               <h3>Summary</h3>
               <div class="stats">
                 <div class="stat">
                   <div class="stat-number total">${totalSubmissions}</div>
                   <div class="stat-label">Total</div>
                 </div>
                 <div class="stat">
                   <div class="stat-number correct">${correctCount}</div>
                   <div class="stat-label">Correct</div>
                 </div>
                 <div class="stat">
                   <div class="stat-number wrong">${wrongCount}</div>
                   <div class="stat-label">Wrong</div>
                 </div>
                 ${pendingCount > 0 ? `
                 <div class="stat">
                   <div class="stat-number pending">${pendingCount}</div>
                   <div class="stat-label">Pending</div>
                 </div>
                 ` : ''}
               </div>
 
               <div class="attachments">
                 <h4>📎 Attached Files</h4>
                 <ul>
                   <li><strong>${jobId}-all-results.xlsx</strong> - Complete verification results</li>
                    <li><strong>${jobId}-student-summary.xlsx</strong> - Aggregated summary by student (${uniqueStudents} students)</li>
                   ${correctCount > 0 ? `<li><strong>${jobId}-correct-results.xlsx</strong> - Verified correct submissions</li>` : ''}
                   ${wrongCount > 0 ? `<li><strong>${jobId}-wrong-results.xlsx</strong> - Failed verifications</li>` : ''}
                 </ul>
               </div>
 
               <p><strong>File:</strong> ${job.file_name}</p>
               <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
               
               <div class="footer">
                 <p>Thank you for using the Student Verification Portal.</p>
               </div>
             </div>
           </div>
         </body>
         </html>
       `,
       attachments,
     });
 
     console.log("Completion email sent successfully:", emailResponse);
 
     // Mark email as sent
     const { error: updateError } = await supabase
       .from("jobs")
       .update({ completion_email_sent: true })
       .eq("job_id", jobId);
 
     if (updateError) {
       console.error("Failed to update completion_email_sent flag:", updateError);
     }
 
     return new Response(
       JSON.stringify({
         success: true,
         message: "Completion email sent successfully",
         stats: { total: totalSubmissions, correct: correctCount, wrong: wrongCount },
       }),
       { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
     );
   } catch (error: unknown) {
     console.error("Error in send-completion-email function:", error);
     const errorMessage = error instanceof Error ? error.message : "Internal server error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
     );
   }
 };
 
 serve(handler);
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { StatusBadge } from '@/components/StatusBadge';
 import { ExternalLink } from 'lucide-react';
 
 export interface Submission {
   id: string;
   roll_number: string;
   student_name: string;
   coursera_link: string | null;
   linkedin_link: string | null;
   coursera_link_duplicate: boolean;
   linkedin_link_duplicate: boolean;
   student_match_auto: string;
   course_match_auto: string;
   student_match_reason: string | null;
   course_match_reason: string | null;
   final_decision: string;
   processing_status: string;
   error_message: string | null;
 }
 
 interface SubmissionsTableProps {
   submissions: Submission[];
 }
 
 export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
   if (submissions.length === 0) {
     return (
       <div className="text-center py-8 text-muted-foreground">
         No submissions found for this job.
       </div>
     );
   }
 
   return (
     <div className="rounded-md border overflow-x-auto">
       <Table>
         <TableHeader>
           <TableRow>
             <TableHead className="min-w-[100px]">Roll No</TableHead>
             <TableHead className="min-w-[150px]">Student Name</TableHead>
             <TableHead className="min-w-[100px]">Student Match</TableHead>
             <TableHead className="min-w-[100px]">Course Match</TableHead>
             <TableHead className="min-w-[100px]">Final Decision</TableHead>
             <TableHead className="min-w-[80px]">Links</TableHead>
             <TableHead className="min-w-[100px]">Status</TableHead>
           </TableRow>
         </TableHeader>
         <TableBody>
           {submissions.map((submission) => (
             <TableRow key={submission.id}>
               <TableCell className="font-mono">{submission.roll_number}</TableCell>
               <TableCell>{submission.student_name}</TableCell>
               <TableCell>
                 <StatusBadge status={submission.student_match_auto as any} />
               </TableCell>
               <TableCell>
                 <StatusBadge status={submission.course_match_auto as any} />
               </TableCell>
               <TableCell>
                 <StatusBadge status={submission.final_decision as any} />
               </TableCell>
               <TableCell>
                 <div className="flex gap-2">
                   {submission.coursera_link && (
                     <a
                       href={submission.coursera_link}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-primary hover:text-primary/80"
                       title="Coursera"
                     >
                       <ExternalLink className="w-4 h-4" />
                     </a>
                   )}
                   {submission.linkedin_link && (
                     <a
                       href={submission.linkedin_link}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-primary hover:text-primary/80"
                       title="LinkedIn"
                     >
                       <ExternalLink className="w-4 h-4" />
                     </a>
                   )}
                 </div>
               </TableCell>
               <TableCell>
                 <span className={`text-xs px-2 py-1 rounded ${
                   submission.processing_status === 'completed' ? 'bg-success/10 text-success' :
                   submission.processing_status === 'error' ? 'bg-destructive/10 text-destructive' :
                   submission.processing_status === 'processing' ? 'bg-primary/10 text-primary' :
                   'bg-muted text-muted-foreground'
                 }`}>
                   {submission.processing_status}
                 </span>
               </TableCell>
             </TableRow>
           ))}
         </TableBody>
       </Table>
     </div>
   );
 }
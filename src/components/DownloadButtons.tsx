 import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
 import * as XLSX from 'xlsx';
 import type { Submission } from './SubmissionsTable';
 
 interface DownloadButtonsProps {
   submissions: Submission[];
   jobId: string;
 }
 
interface StudentSummary {
  rollNumber: string;
  studentName: string;
  totalSubmissions: number;
  rightSubmissions: number;
  wrongSubmissions: number;
  marks: number;
}

 export function DownloadButtons({ submissions, jobId }: DownloadButtonsProps) {
   const downloadExcel = (type: 'all' | 'correct' | 'wrong') => {
     let data = submissions;
     let filename = `${jobId}-all-results.xlsx`;
 
     if (type === 'correct') {
       data = submissions.filter(s => s.final_decision === 'Correct');
       filename = `${jobId}-correct-results.xlsx`;
     } else if (type === 'wrong') {
       data = submissions.filter(s => s.final_decision === 'Wrong');
       filename = `${jobId}-wrong-results.xlsx`;
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
     XLSX.writeFile(wb, filename);
   };
 
  const downloadSummary = () => {
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
    XLSX.writeFile(wb, `${jobId}-student-summary.xlsx`);
  };

   const correctCount = submissions.filter(s => s.final_decision === 'Correct').length;
   const wrongCount = submissions.filter(s => s.final_decision === 'Wrong').length;
  const uniqueStudents = new Set(submissions.map(s => s.roll_number)).size;
 
   return (
     <div className="flex flex-wrap gap-2">
       <Button variant="outline" onClick={() => downloadExcel('all')}>
         <Download className="w-4 h-4 mr-2" />
         All Results ({submissions.length})
       </Button>
       <Button 
         variant="outline" 
         onClick={() => downloadExcel('correct')}
         disabled={correctCount === 0}
         className="text-success border-success/50 hover:bg-success/10"
       >
         <Download className="w-4 h-4 mr-2" />
         Correct ({correctCount})
       </Button>
       <Button 
         variant="outline" 
         onClick={() => downloadExcel('wrong')}
         disabled={wrongCount === 0}
         className="text-destructive border-destructive/50 hover:bg-destructive/10"
       >
         <Download className="w-4 h-4 mr-2" />
         Wrong ({wrongCount})
       </Button>
      <Button 
        variant="outline" 
        onClick={downloadSummary}
        className="text-primary border-primary/50 hover:bg-primary/10"
      >
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        Student Summary ({uniqueStudents})
      </Button>
     </div>
   );
 }
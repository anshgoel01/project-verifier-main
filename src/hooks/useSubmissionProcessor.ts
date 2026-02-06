import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import type { StudentSubmission, ProcessingProgress } from '@/types/submission';

export function useSubmissionProcessor() {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress>({
    total: 0,
    completed: 0,
    processing: 0,
    errors: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const parseExcelFile = useCallback(async (file: File): Promise<StudentSubmission[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Count duplicates
          const courseraLinks = jsonData.map((row: any) => row['Coursera Completion Certificate Link'] || row['Coursera Certificate Link'] || '');
          const linkedinLinks = jsonData.map((row: any) => row['LinkedIn Post Link'] || '');
          
          const courseraCount = courseraLinks.reduce((acc: Record<string, number>, link: string) => {
            acc[link] = (acc[link] || 0) + 1;
            return acc;
          }, {});
          
          const linkedinCount = linkedinLinks.reduce((acc: Record<string, number>, link: string) => {
            acc[link] = (acc[link] || 0) + 1;
            return acc;
          }, {});

          const submissions: StudentSubmission[] = jsonData.map((row: any, index: number) => {
            const courseraLink = row['Coursera Completion Certificate Link'] || row['Coursera Certificate Link'] || '';
            const linkedinLink = row['LinkedIn Post Link'] || '';

            // Flexible column name matching for roll number
            const rollNumber = String(
              row['Roll Number of the Student'] || 
              row['Roll Number'] || 
              row['Roll No'] || 
              row['Roll No.'] || 
              row['RollNumber'] || 
              row['Rollno'] ||
              row['rollno'] ||
              row['roll_number'] ||
              ''
            );

            // Flexible column name matching for student name
            const studentName = String(
              row['Student Name'] || 
              row['Name'] || 
              row['StudentName'] ||
              row['student_name'] ||
              ''
            );

            return {
              id: `sub-${index}-${Date.now()}`,
              rollNumber,
              studentName,
              courseraLink,
              linkedinLink,
              courseraLinkDuplicate: courseraCount[courseraLink] > 1,
              linkedinLinkDuplicate: linkedinCount[linkedinLink] > 1,
              studentMatchAuto: 'Pending',
              courseMatchAuto: 'Pending',
              adminStudentVerification: 'Not Reviewed',
              adminCourseVerification: 'Not Reviewed',
              finalDecision: 'Pending',
              processingStatus: 'pending',
            };
          });

          resolve(submissions);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  }, []);

  const verifySubmission = useCallback(async (submission: StudentSubmission): Promise<StudentSubmission> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-submission', {
        body: {
          studentName: submission.studentName,
          courseraLink: submission.courseraLink,
          linkedinLink: submission.linkedinLink,
        },
      });

      if (error) throw error;

      return {
        ...submission,
        studentMatchAuto: data.studentMatchAuto,
        courseMatchAuto: data.courseMatchAuto,
        studentMatchReason: data.studentMatchReason,
        courseMatchReason: data.courseMatchReason,
        scrapedCourseraName: data.scrapedCourseraName,
        scrapedCourseraProject: data.scrapedCourseraProject,
        scrapedLinkedinName: data.scrapedLinkedinName,
        scrapedLinkedinText: data.scrapedLinkedinText,
        processingStatus: 'completed',
        finalDecision: data.studentMatchAuto === 'Yes' && data.courseMatchAuto === 'Yes' ? 'Correct' : 'Wrong',
      };
    } catch (error) {
      console.error('Verification error:', error);
      return {
        ...submission,
        studentMatchAuto: 'No',
        courseMatchAuto: 'No',
        processingStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Verification failed',
        finalDecision: 'Wrong',
      };
    }
  }, []);

  const processSubmissions = useCallback(async (file: File) => {
    setIsProcessing(true);
    
    try {
      const parsedSubmissions = await parseExcelFile(file);
      setSubmissions(parsedSubmissions);
      setProgress({
        total: parsedSubmissions.length,
        completed: 0,
        processing: 0,
        errors: 0,
      });

      // Process in batches of 5 for concurrent execution
      const batchSize = 5;
      const results: StudentSubmission[] = [...parsedSubmissions];

      for (let i = 0; i < parsedSubmissions.length; i += batchSize) {
        const batch = parsedSubmissions.slice(i, i + batchSize);
        
        setProgress((prev) => ({
          ...prev,
          processing: batch.length,
        }));

        const batchResults = await Promise.all(
          batch.map((sub) => verifySubmission(sub))
        );

        batchResults.forEach((result, batchIndex) => {
          const globalIndex = i + batchIndex;
          results[globalIndex] = result;
        });

        setSubmissions([...results]);
        
        const completedCount = batchResults.filter((r) => r.processingStatus === 'completed').length;
        const errorCount = batchResults.filter((r) => r.processingStatus === 'error').length;

        setProgress((prev) => ({
          ...prev,
          completed: prev.completed + completedCount,
          errors: prev.errors + errorCount,
          processing: 0,
        }));
      }
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [parseExcelFile, verifySubmission]);

  const updateSubmission = useCallback((id: string, updates: Partial<StudentSubmission>) => {
    setSubmissions((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, ...updates } : sub))
    );
  }, []);

  const exportToExcel = useCallback(() => {
    const exportData = submissions.map((sub) => ({
      'Roll Number': sub.rollNumber,
      'Student Name': sub.studentName,
      'Coursera Certificate Link': sub.courseraLink,
      'LinkedIn Post Link': sub.linkedinLink,
      'Coursera Link Duplicate Flag': sub.courseraLinkDuplicate ? 'Yes' : 'No',
      'LinkedIn Link Duplicate Flag': sub.linkedinLinkDuplicate ? 'Yes' : 'No',
      'Student Match Status (Auto)': sub.studentMatchAuto,
      'Student Match Reason': sub.studentMatchReason || '',
      'Course Match Status (Auto)': sub.courseMatchAuto,
      'Course Match Reason': sub.courseMatchReason || '',
      'Admin Student Verification': sub.adminStudentVerification,
      'Admin Course Verification': sub.adminCourseVerification,
      'Final Decision': sub.finalDecision,
      'Admin Manual Override': sub.adminOverride || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Verification Results');
    XLSX.writeFile(workbook, `verification_results_${Date.now()}.xlsx`);
  }, [submissions]);

  return {
    submissions,
    progress,
    isProcessing,
    processSubmissions,
    updateSubmission,
    exportToExcel,
  };
}

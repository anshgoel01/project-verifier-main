export interface StudentSubmission {
  id: string;
  rollNumber: string;
  studentName: string;
  courseraLink: string;
  linkedinLink: string;
  courseraLinkDuplicate: boolean;
  linkedinLinkDuplicate: boolean;
  studentMatchAuto: 'Yes' | 'No' | 'Pending';
  courseMatchAuto: 'Yes' | 'No' | 'Pending';
  studentMatchReason?: string;
  courseMatchReason?: string;
  adminStudentVerification: 'Not Reviewed' | 'Correct' | 'Wrong';
  adminCourseVerification: 'Not Reviewed' | 'Correct' | 'Wrong';
  finalDecision: 'Correct' | 'Wrong' | 'Pending';
  adminOverride?: string;
  
  // Scraped data for admin review
  scrapedCourseraName?: string;
  scrapedCourseraProject?: string;
  scrapedLinkedinName?: string;
  scrapedLinkedinText?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface VerificationResult {
  studentMatchAuto: 'Yes' | 'No';
  courseMatchAuto: 'Yes' | 'No';
  studentMatchReason: string;
  courseMatchReason: string;
  scrapedCourseraName: string;
  scrapedCourseraProject: string;
  scrapedLinkedinName: string;
  scrapedLinkedinText: string;
}

export interface ProcessingProgress {
  total: number;
  completed: number;
  processing: number;
  errors: number;
}

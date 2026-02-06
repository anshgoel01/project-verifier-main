import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUpload } from '@/components/FileUpload';
import { EmailSubmitForm } from '@/components/EmailSubmitForm';
import { ProcessingProgress } from '@/components/ProcessingProgress';
import { AdminTable } from '@/components/AdminTable';
import { useSubmissionProcessor } from '@/hooks/useSubmissionProcessor';
import { Navbar } from '@/components/Navbar';
import * as XLSX from 'xlsx';

type ViewState = 'upload' | 'email' | 'processing' | 'review';

const Index = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  
  const {
    submissions,
    progress,
    isProcessing,
    processSubmissions,
    updateSubmission,
    exportToExcel,
  } = useSubmissionProcessor();

  const countSubmissions = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData.length);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    try {
      const count = await countSubmissions(file);
      setSubmissionCount(count);
      setView('email');
    } catch (error) {
      console.error('Error counting submissions:', error);
      setSubmissionCount(0);
      setView('email');
    }
  };

  const handleJobCreated = (jobId: string) => {
    navigate(`/job-status?id=${jobId}`);
  };

  const handleBackToUpload = () => {
    setSelectedFile(null);
    setSubmissionCount(0);
    setView('upload');
  };

  // Legacy flow for direct processing (if needed)
  const handleDirectProcess = async (file: File) => {
    setView('processing');
    await processSubmissions(file);
    setView('review');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {view === 'upload' && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Upload Student Submissions
              </h2>
              <p className="text-muted-foreground">
                Upload an Excel file containing student names, roll numbers, Coursera certificates, and LinkedIn posts
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-card rounded-xl border">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-success font-bold">1</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Upload Excel</h3>
                <p className="text-sm text-muted-foreground">
                  Drop your .xlsx file with student data including certificate and post links
                </p>
              </div>
              <div className="p-6 bg-card rounded-xl border">
                <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-warning font-bold">2</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Submit Job</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your email and submit to create a verification job
                </p>
              </div>
              <div className="p-6 bg-card rounded-xl border">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Track Status</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor your job status and receive email notifications
                </p>
              </div>
            </div>
          </div>
        )}

        {view === 'email' && selectedFile && (
          <div className="py-8">
            <EmailSubmitForm
              file={selectedFile}
              totalSubmissions={submissionCount}
              onJobCreated={handleJobCreated}
              onBack={handleBackToUpload}
            />
          </div>
        )}

        {view === 'processing' && (
          <div className="py-12">
            <ProcessingProgress progress={progress} />
          </div>
        )}

        {view === 'review' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground mb-1">
                Verification Results
              </h2>
              <p className="text-muted-foreground">
                Review auto-verification results and make manual corrections
              </p>
            </div>
            <AdminTable
              submissions={submissions}
              onUpdateSubmission={updateSubmission}
              onExport={exportToExcel}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

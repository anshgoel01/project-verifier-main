import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      }
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleDownloadSample = useCallback(() => {
    const sampleData = [
      {
        'Roll Number': '2024CS001',
        'Name': 'John Doe',
        'Coursera Certificate Link': 'https://www.coursera.org/account/accomplishments/certificate/ABC123XYZ',
        'LinkedIn Post Link': 'https://www.linkedin.com/posts/johndoe_certificate-activity-1234567890',
      },
      {
        'Roll Number': '2024CS002',
        'Name': 'Jane Smith',
        'Coursera Certificate Link': 'https://www.coursera.org/account/accomplishments/certificate/DEF456UVW',
        'LinkedIn Post Link': 'https://www.linkedin.com/posts/janesmith_learning-activity-0987654321',
      },
      {
        'Roll Number': '2024CS003',
        'Name': 'Alex Johnson',
        'Coursera Certificate Link': 'https://www.coursera.org/account/accomplishments/certificate/GHI789RST',
        'LinkedIn Post Link': 'https://www.linkedin.com/posts/alexjohnson_course-activity-1122334455',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, 'sample_student_submissions.xlsx');
  }, []);

  const handleProcess = useCallback(() => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  }, [selectedFile, onFileSelect]);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div
        className={cn(
          'upload-zone',
          dragActive && 'upload-zone-active'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
              <FileSpreadsheet className="w-8 h-8 text-success" />
              <div className="text-left">
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="p-1 hover:bg-muted rounded-md transition-colors ml-2"
                disabled={isProcessing}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing}
              size="lg"
              className="mt-2"
            >
              {isProcessing ? 'Processing...' : 'Start Verification'}
            </Button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-secondary rounded-full">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  Drop your Excel file here
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse (.xlsx, .xls)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDownloadSample();
                }}
                className="mt-2"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Sample Excel
              </Button>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}

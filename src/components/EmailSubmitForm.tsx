import { useState } from 'react';
import { Mail, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface SubmissionRow {
  rollNumber: string;
  studentName: string;
  courseraLink: string;
  linkedinLink: string;
}

interface EmailSubmitFormProps {
  file: File;
  totalSubmissions: number;
  onJobCreated: (jobId: string) => void;
  onBack: () => void;
}

// Normalize column name for flexible matching
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[_\s.]+/g, "") // Remove underscores, spaces, dots
    .trim();
}

// Find column index with flexible matching
function findColumnKey(headers: string[], possibleNames: string[]): string | null {
  const normalizedPossibleNames = possibleNames.map(normalizeColumnName);
  
  // Priority 1: Exact match after normalization
  for (const header of headers) {
    const normalizedHeader = normalizeColumnName(header);
    if (normalizedPossibleNames.includes(normalizedHeader)) {
      return header;
    }
  }
  
  // Priority 2: Starts with any possible name
  for (const header of headers) {
    const normalizedHeader = normalizeColumnName(header);
    for (const name of normalizedPossibleNames) {
      if (normalizedHeader.startsWith(name) || name.startsWith(normalizedHeader)) {
        return header;
      }
    }
  }
  
  // Priority 3: Contains any possible name
  for (const header of headers) {
    const normalizedHeader = normalizeColumnName(header);
    for (const name of normalizedPossibleNames) {
      if (normalizedHeader.includes(name) || name.includes(normalizedHeader)) {
        return header;
      }
    }
  }
  
  return null;
}

// Normalize a value to string, trimmed, or null if empty
function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str === "" ? null : str;
}

export function EmailSubmitForm({ file, totalSubmissions, onJobCreated, onBack }: EmailSubmitFormProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const parseExcelFile = async (file: File): Promise<SubmissionRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            console.error("Excel file contains no data rows");
            resolve([]);
            return;
          }

          // Get headers from first row
          const headers = Object.keys(jsonData[0] as Record<string, unknown>);
          console.log("Parsed headers:", headers);

          // Find column keys using flexible matching
          const rollNumberKey = findColumnKey(headers, [
            'roll number', 'rollnumber', 'roll no', 'rollno', 'roll', 'id', 'student id', 'studentid'
          ]);
          const nameKey = findColumnKey(headers, [
            'name', 'student name', 'studentname', 'full name', 'fullname'
          ]);
          const courseraKey = findColumnKey(headers, [
            'coursera certificate link', 'coursera link', 'courseralink', 'coursera', 'coursera_url', 
            'certificate link', 'certificatelink', 'certificate'
          ]);
          const linkedinKey = findColumnKey(headers, [
            'linkedin post link', 'linkedin link', 'linkedinlink', 'linkedin', 'linkedin_url',
            'post link', 'postlink', 'post'
          ]);

          console.log("Column mapping:", { rollNumberKey, nameKey, courseraKey, linkedinKey });

          // Parse and normalize all rows
          const parsedRows = jsonData.map((row: Record<string, unknown>, index: number) => {
            const rollNumber = rollNumberKey ? normalizeValue(row[rollNumberKey]) : null;
            const studentName = nameKey ? normalizeValue(row[nameKey]) : null;
            const courseraLink = courseraKey ? normalizeValue(row[courseraKey]) : null;
            const linkedinLink = linkedinKey ? normalizeValue(row[linkedinKey]) : null;

            return { rollNumber, studentName, courseraLink, linkedinLink, rowIndex: index + 2 };
          });

          // Log first 3 rows for debugging
          console.log("First 3 parsed rows:", parsedRows.slice(0, 3));

          // Validate rows - require all four fields
          const validSubmissions: SubmissionRow[] = [];
          const invalidRows: { rowIndex: number; missing: string[] }[] = [];

          parsedRows.forEach((row) => {
            const missing: string[] = [];
            if (!row.rollNumber) missing.push("Roll Number");
            if (!row.studentName) missing.push("Name");
            if (!row.courseraLink) missing.push("Coursera Link");
            if (!row.linkedinLink) missing.push("LinkedIn Link");

            if (missing.length === 0) {
              validSubmissions.push({
                rollNumber: row.rollNumber!,
                studentName: row.studentName!,
                courseraLink: row.courseraLink!,
                linkedinLink: row.linkedinLink!,
              });
            } else {
              invalidRows.push({ rowIndex: row.rowIndex, missing });
            }
          });

          console.log(
            `Validation result: ${validSubmissions.length} valid, ${invalidRows.length} invalid out of ${parsedRows.length} total`
          );

          // Log details if no valid rows found
          if (validSubmissions.length === 0 && parsedRows.length > 0) {
            console.error("No valid submissions found!");
            console.error("Headers found:", headers);
            console.error("Column mapping:", { rollNumberKey, nameKey, courseraKey, linkedinKey });
            console.error("First 3 rows:", parsedRows.slice(0, 3));
            console.error("Invalid row reasons:", invalidRows.slice(0, 5));
          }

          resolve(validSubmissions);
        } catch (error) {
          console.error("Excel parsing error:", error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to receive job notifications.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse the Excel file to get submission rows
      const submissions = await parseExcelFile(file);
      
      if (submissions.length === 0) {
        toast({
          title: "No valid submissions",
        description: "The Excel file doesn't contain valid rows. Required columns: Roll Number, Name, Coursera Link, LinkedIn Link. Check console for details.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-job', {
        body: {
          email,
          fileName: file.name,
          totalSubmissions: submissions.length,
          submissions,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success && data.jobId) {
        toast({
          title: "Job created successfully!",
          description: `Your job ID is ${data.jobId}. Check your email for confirmation.`,
        });
        onJobCreated(data.jobId);
      } else {
        throw new Error(data.error || 'Failed to create job');
      }
    } catch (error) {
      console.error('Job creation error:', error);
      toast({
        title: "Failed to create job",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Submit Verification Job
        </CardTitle>
        <CardDescription>
          Enter your email to receive job status notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Selected File</p>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''} to verify
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              You'll receive a confirmation email with your Job ID
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Job...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Job
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { ExternalLink, Search, AlertTriangle, Download } from 'lucide-react';
import type { StudentSubmission } from '@/types/submission';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdminTableProps {
  submissions: StudentSubmission[];
  onUpdateSubmission: (id: string, updates: Partial<StudentSubmission>) => void;
  onExport: () => void;
}

export function AdminTable({ submissions, onUpdateSubmission, onExport }: AdminTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesSearch =
        sub.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'pending' && sub.adminStudentVerification === 'Not Reviewed') ||
        (filterStatus === 'correct' && sub.finalDecision === 'Correct') ||
        (filterStatus === 'wrong' && sub.finalDecision === 'Wrong') ||
        (filterStatus === 'mismatch' && (sub.studentMatchAuto === 'No' || sub.courseMatchAuto === 'No')) ||
        (filterStatus === 'duplicate' && (sub.courseraLinkDuplicate || sub.linkedinLinkDuplicate));

      return matchesSearch && matchesFilter;
    });
  }, [submissions, searchTerm, filterStatus]);

  const handleVerificationChange = (
    id: string,
    field: 'adminStudentVerification' | 'adminCourseVerification',
    value: string
  ) => {
    const updates: Partial<StudentSubmission> = {
      [field]: value as 'Not Reviewed' | 'Correct' | 'Wrong',
    };

    // Auto-calculate final decision
    const submission = submissions.find((s) => s.id === id);
    if (submission) {
      const studentVer = field === 'adminStudentVerification' ? value : submission.adminStudentVerification;
      const courseVer = field === 'adminCourseVerification' ? value : submission.adminCourseVerification;

      if (studentVer === 'Correct' && courseVer === 'Correct') {
        updates.finalDecision = 'Correct';
      } else if (studentVer === 'Wrong' || courseVer === 'Wrong') {
        updates.finalDecision = 'Wrong';
      } else {
        updates.finalDecision = 'Pending';
      }
    }

    onUpdateSubmission(id, updates);
  };

  const truncateUrl = (url: string, maxLength = 30) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Submissions</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="correct">Verified Correct</SelectItem>
            <SelectItem value="wrong">Marked Wrong</SelectItem>
            <SelectItem value="mismatch">Auto-Mismatch</SelectItem>
            <SelectItem value="duplicate">Duplicates</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onExport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Excel
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-24">Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="text-center">Duplicates</TableHead>
                <TableHead className="text-center">Auto Match</TableHead>
                <TableHead>Reason for No</TableHead>
                <TableHead className="text-center">Student Verify</TableHead>
                <TableHead className="text-center">Course Verify</TableHead>
                <TableHead className="text-center">Final Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => (
                <TableRow key={submission.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm">
                    {submission.rollNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{submission.studentName}</p>
                      {submission.scrapedCourseraName && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px] cursor-help">
                              Coursera: {submission.scrapedCourseraName}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm">
                            <p><strong>Coursera Name:</strong> {submission.scrapedCourseraName}</p>
                            <p><strong>Project:</strong> {submission.scrapedCourseraProject || 'N/A'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <a
                        href={submission.courseraLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <span>{truncateUrl(submission.courseraLink)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={submission.linkedinLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <span>{truncateUrl(submission.linkedinLink)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      {submission.courseraLinkDuplicate && (
                        <span className="status-badge status-badge-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Coursera
                        </span>
                      )}
                      {submission.linkedinLinkDuplicate && (
                        <span className="status-badge status-badge-warning flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          LinkedIn
                        </span>
                      )}
                      {!submission.courseraLinkDuplicate && !submission.linkedinLinkDuplicate && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <StatusBadge status={submission.studentMatchAuto} />
                      <StatusBadge status={submission.courseMatchAuto} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground max-w-[200px]">
                      {submission.studentMatchAuto === 'No' && submission.studentMatchReason && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="truncate cursor-help text-destructive">
                              Student: {submission.studentMatchReason}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm">
                            <p>{submission.studentMatchReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {submission.courseMatchAuto === 'No' && submission.courseMatchReason && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="truncate cursor-help text-destructive">
                              Course: {submission.courseMatchReason}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm">
                            <p>{submission.courseMatchReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {submission.studentMatchAuto !== 'No' && submission.courseMatchAuto !== 'No' && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={submission.adminStudentVerification}
                      onValueChange={(value) =>
                        handleVerificationChange(submission.id, 'adminStudentVerification', value)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Reviewed">Not Reviewed</SelectItem>
                        <SelectItem value="Correct">Correct</SelectItem>
                        <SelectItem value="Wrong">Wrong</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={submission.adminCourseVerification}
                      onValueChange={(value) =>
                        handleVerificationChange(submission.id, 'adminCourseVerification', value)
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Reviewed">Not Reviewed</SelectItem>
                        <SelectItem value="Correct">Correct</SelectItem>
                        <SelectItem value="Wrong">Wrong</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={submission.finalDecision} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredSubmissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No submissions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredSubmissions.length} of {submissions.length} submissions
      </div>
    </div>
  );
}

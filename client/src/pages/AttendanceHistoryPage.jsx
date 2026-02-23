import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { studentsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

export default function AttendanceHistoryPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split("T")[0], // First day of month
    to: new Date().toISOString().split("T")[0], // Today
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await studentsAPI.list({ search: searchTerm });
      setStudents(response.data.students || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Failed to load students",
        variant: "destructive",
      });
    }
  };

  const fetchAttendance = async () => {
    if (!selectedStudent) return;

    try {
      setLoading(true);
      const response = await studentsAPI.getAttendance(selectedStudent, {
        from: dateRange.from,
        to: dateRange.to,
        limit: 100,
      });

      setAttendanceData(response.data);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      const message =
        error.response?.data?.error?.message || "Failed to load attendance";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleViewAttendance = () => {
    fetchAttendance();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Present":
        return (
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Present
          </Badge>
        );
      case "Absent":
        return (
          <Badge variant="danger">
            <XCircle className="h-3 w-3 mr-1" />
            Absent
          </Badge>
        );
      case "Late":
        return (
          <Badge variant="warning">
            <Clock className="h-3 w-3 mr-1" />
            Late
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!isAdmin()) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          Only administrators can access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Attendance History
        </h1>
        <p className="text-muted-foreground">
          View individual student attendance records
        </p>
      </div>

      {/* Student Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
          <CardDescription>
            Search and select a student to view their attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit">Search</Button>
            </div>

            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={selectedStudent}
                onValueChange={setSelectedStudent}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No students found
                    </div>
                  ) : (
                    students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} - {student.className}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Date Range & View Button */}
      {selectedStudent && (
        <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
            <CardDescription>
              Select the period to view attendance records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="from">From Date</Label>
                <Input
                  id="from"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, from: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="to">To Date</Label>
                <Input
                  id="to"
                  type="date"
                  value={dateRange.to}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, to: e.target.value })
                  }
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleViewAttendance}
                  className="w-full"
                  disabled={loading}
                >
                  <History className="mr-2 h-4 w-4" />
                  {loading ? "Loading..." : "View Attendance"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Summary */}
      {attendanceData && (
        <Card>
          <CardHeader>
            <CardTitle>
              {attendanceData.student.name} - {attendanceData.student.className}
            </CardTitle>
            <CardDescription>
              Attendance summary from{" "}
              {format(new Date(dateRange.from), "MMM d, yyyy")} to{" "}
              {format(new Date(dateRange.to), "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Records
                      </p>
                      <p className="text-2xl font-bold">
                        {attendanceData.summary.totalRecords}
                      </p>
                    </div>
                    <History className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Present
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {attendanceData.summary.present}
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Absent
                      </p>
                      <p className="text-2xl font-bold text-red-600">
                        {attendanceData.summary.absent}
                      </p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Attendance Rate
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {attendanceData.summary.attendanceRate}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Records Table */}
            {attendanceData.records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records found for this period</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{record.timeSlot.subjectName}</TableCell>
                      <TableCell>P{record.timeSlot.periodNumber}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.recordedBy}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {attendanceData.pagination.total >
              attendanceData.records.length && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing {attendanceData.records.length} of{" "}
                {attendanceData.pagination.total} records
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedStudent && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              Select a student to view attendance
            </p>
            <p className="text-sm text-muted-foreground">
              Search and select a student from the dropdown above
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

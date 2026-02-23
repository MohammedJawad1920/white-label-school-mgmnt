import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceAPI, classesAPI } from "@/lib/api";
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
  BarChart3,
  Download,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

export default function AttendanceReportsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)).toISOString().split("T")[0], // First day of month
    to: new Date().toISOString().split("T")[0], // Today
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await classesAPI.list();
      setClasses(response.data.classes || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast({
        title: "Error",
        description: "Failed to load classes",
        variant: "destructive",
      });
    }
  };

  const fetchReport = async () => {
    if (!selectedClass) {
      toast({
        title: "Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await attendanceAPI.getSummary({
        classId: selectedClass,
        from: dateRange.from,
        to: dateRange.to,
      });

      setReportData(response.data);
    } catch (error) {
      console.error("Error fetching report:", error);
      const message =
        error.response?.data?.error?.message || "Failed to load report";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const headers = [
      "Student Name",
      "Present",
      "Absent",
      "Late",
      "Attendance Rate",
    ];
    const rows = reportData.byStudent.map((student) => [
      student.studentName,
      student.present,
      student.absent,
      student.late,
      student.attendanceRate + "%",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${reportData.class.name}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Report exported successfully",
    });
  };

  const getAttendanceColor = (rate) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 75) return "text-yellow-600";
    return "text-red-600";
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
          Attendance Reports
        </h1>
        <p className="text-muted-foreground">
          View class-level attendance summaries and analytics
        </p>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>
            Select class and date range to view attendance summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.batch_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                onClick={fetchReport}
                className="w-full"
                disabled={loading}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                {loading ? "Loading..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Summary */}
      {reportData && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{reportData.class.name}</CardTitle>
                  <CardDescription>
                    {format(new Date(reportData.period.from), "MMM d, yyyy")} -{" "}
                    {format(new Date(reportData.period.to), "MMM d, yyyy")} (
                    {reportData.period.days} days)
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Students
                        </p>
                        <p className="text-2xl font-bold">
                          {reportData.class.studentCount}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Records
                        </p>
                        <p className="text-2xl font-bold">
                          {reportData.summary.totalRecords}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-muted-foreground" />
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
                          {reportData.summary.present}
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
                          {reportData.summary.absent}
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
                          Avg. Rate
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          {reportData.summary.attendanceRate}%
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Student-wise Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Student-wise Attendance</CardTitle>
              <CardDescription>
                Detailed attendance breakdown for each student
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.byStudent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records found for this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-right">
                        Attendance Rate
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.byStudent.map((student, index) => (
                      <TableRow key={student.studentId}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.studentName}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="success">{student.present}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="danger">{student.absent}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="warning">{student.late}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {student.present + student.absent + student.late}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-lg font-bold ${getAttendanceColor(student.attendanceRate)}`}
                          >
                            {student.attendanceRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reportData.byStudent.filter((s) => s.attendanceRate < 75)
                  .length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-semibold text-red-900 mb-2">
                      ⚠️ Low Attendance Alert
                    </p>
                    <p className="text-sm text-red-700">
                      {
                        reportData.byStudent.filter(
                          (s) => s.attendanceRate < 75,
                        ).length
                      }{" "}
                      student(s) have attendance below 75%. Consider reaching
                      out to parents.
                    </p>
                  </div>
                )}

                {reportData.byStudent.filter((s) => s.attendanceRate >= 95)
                  .length > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-semibold text-green-900 mb-2">
                      ✨ Excellent Attendance
                    </p>
                    <p className="text-sm text-green-700">
                      {
                        reportData.byStudent.filter(
                          (s) => s.attendanceRate >= 95,
                        ).length
                      }{" "}
                      student(s) have attendance above 95%. Well done!
                    </p>
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-semibold text-blue-900 mb-2">
                    📊 Class Overview
                  </p>
                  <p className="text-sm text-blue-700">
                    Class average: {reportData.summary.attendanceRate}% • Total
                    periods: {reportData.summary.totalRecords} • Coverage:{" "}
                    {(
                      (reportData.summary.totalRecords /
                        (reportData.class.studentCount *
                          reportData.period.days)) *
                      100
                    ).toFixed(1)}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!reportData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              Generate your first report
            </p>
            <p className="text-sm text-muted-foreground">
              Select a class and date range, then click "Generate Report"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

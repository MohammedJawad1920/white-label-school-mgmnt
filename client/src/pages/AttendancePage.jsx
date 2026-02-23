import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  timetableAPI,
  classesAPI,
  studentsAPI,
  attendanceAPI,
} from "@/lib/api";
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
  ClipboardCheck,
  Save,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "Present", label: "Present", icon: CheckCircle2, color: "success" },
  { value: "Absent", label: "Absent", icon: XCircle, color: "danger" },
  { value: "Late", label: "Late", icon: Clock, color: "warning" },
];

export default function AttendancePage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [myClasses, setMyClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("Present");
  const [studentStatuses, setStudentStatuses] = useState({});

  useEffect(() => {
    fetchMyClasses();
  }, [selectedDate]);

  const fetchMyClasses = async () => {
    try {
      setLoading(true);
      const dayOfWeek = format(new Date(selectedDate), "EEEE");

      const params = {
        date: selectedDate,
        dayOfWeek: dayOfWeek,
        status: "Active",
      };

      if (!isAdmin()) {
        params.teacherId = user.id;
      }

      const response = await timetableAPI.get(params);
      setMyClasses(response.data.timetable || []);

      // Auto-select first class if available
      if (response.data.timetable?.length > 0 && !selectedTimeSlot) {
        setSelectedTimeSlot(response.data.timetable[0].id);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast({
        title: "Error",
        description: "Failed to load classes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTimeSlot) {
      fetchStudents();
    }
  }, [selectedTimeSlot]);

  const fetchStudents = async () => {
    try {
      const timeSlot = myClasses.find((c) => c.id === selectedTimeSlot);
      if (!timeSlot) return;

      const response = await studentsAPI.list({ classId: timeSlot.class_id });
      const studentList = response.data.students || [];

      setStudents(studentList);

      // Initialize all students with default status
      const initialStatuses = {};
      studentList.forEach((student) => {
        initialStatuses[student.id] = defaultStatus;
      });
      setStudentStatuses(initialStatuses);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Failed to load students",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = (studentId, status) => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSetAllStatus = (status) => {
    const newStatuses = {};
    students.forEach((student) => {
      newStatuses[student.id] = status;
    });
    setStudentStatuses(newStatuses);
    setDefaultStatus(status);
  };

  const handleSubmit = async () => {
    if (!selectedTimeSlot) {
      toast({
        title: "Error",
        description: "Please select a class period",
        variant: "destructive",
      });
      return;
    }

    if (students.length === 0) {
      toast({
        title: "Error",
        description: "No students in this class",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Build exceptions list (students with non-default status)
      const exceptions = [];
      Object.entries(studentStatuses).forEach(([studentId, status]) => {
        if (status !== defaultStatus) {
          exceptions.push({ studentId, status });
        }
      });

      const payload = {
        timeSlotId: selectedTimeSlot,
        date: selectedDate,
        defaultStatus: defaultStatus,
        exceptions: exceptions,
      };

      const response = await attendanceAPI.recordClass(payload);

      toast({
        title: "Success",
        description: `Attendance recorded: ${response.data.present} present, ${response.data.absent} absent, ${response.data.late} late`,
      });

      // Clear selections
      setSelectedTimeSlot("");
      setStudents([]);
      setStudentStatuses({});
    } catch (error) {
      console.error("Error recording attendance:", error);
      const message =
        error.response?.data?.error?.message || "Failed to record attendance";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClass = myClasses.find((c) => c.id === selectedTimeSlot);

  const statusCounts = {
    Present: Object.values(studentStatuses).filter((s) => s === "Present")
      .length,
    Absent: Object.values(studentStatuses).filter((s) => s === "Absent").length,
    Late: Object.values(studentStatuses).filter((s) => s === "Late").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Attendance</h1>
        <p className="text-muted-foreground">
          Mark attendance for your classes
        </p>
      </div>

      {/* Date & Class Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Class Period</CardTitle>
          <CardDescription>
            Choose the date and class to record attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTimeSlot("");
                  setStudents([]);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeslot">Class Period</Label>
              <Select
                value={selectedTimeSlot}
                onValueChange={setSelectedTimeSlot}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {myClasses.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No classes scheduled for this date
                    </div>
                  ) : (
                    myClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        P{cls.period_number} - {cls.subject_name} (
                        {cls.class_name})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedClass && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-blue-900">
                    {selectedClass.subject_name} - {selectedClass.class_name}
                  </p>
                  <p className="text-sm text-blue-700">
                    Period {selectedClass.period_number} •{" "}
                    {selectedClass.day_of_week} • {selectedClass.start_time} -{" "}
                    {selectedClass.end_time}
                  </p>
                </div>
                <Badge variant="success">{students.length} students</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Recording */}
      {students.length > 0 && (
        <>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Set all students to the same status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.value}
                      variant={
                        defaultStatus === option.value ? "default" : "outline"
                      }
                      onClick={() => handleSetAllStatus(option.value)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      Mark All {option.label}
                    </Button>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">
                    {statusCounts.Present} Present
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">
                    {statusCounts.Absent} Absent
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium">
                    {statusCounts.Late} Late
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle>Student Attendance</CardTitle>
              <CardDescription>
                {format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.name}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={studentStatuses[student.id] || defaultStatus}
                          onValueChange={(value) =>
                            handleStatusChange(student.id, value)
                          }
                        >
                          <SelectTrigger className="w-[130px] ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => {
                              const Icon = option.icon;
                              return (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    {option.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end mt-6">
                <Button onClick={handleSubmit} disabled={submitting} size="lg">
                  <Save className="mr-2 h-5 w-5" />
                  {submitting ? "Saving..." : "Save Attendance"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!loading && myClasses.length > 0 && !selectedTimeSlot && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              Select a class to record attendance
            </p>
            <p className="text-sm text-muted-foreground">
              Choose a class period from the dropdown above
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && myClasses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">No classes scheduled</p>
            <p className="text-sm text-muted-foreground">
              There are no classes for{" "}
              {format(new Date(selectedDate), "EEEE, MMMM d")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

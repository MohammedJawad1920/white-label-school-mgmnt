import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { timetableAPI, classesAPI, subjectsAPI, usersAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Plus, Trash2, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

// Color palette for teachers
const TEACHER_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-green-100 border-green-300 text-green-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-orange-100 border-orange-300 text-orange-900",
  "bg-pink-100 border-pink-300 text-pink-900",
  "bg-yellow-100 border-yellow-300 text-yellow-900",
  "bg-indigo-100 border-indigo-300 text-indigo-900",
  "bg-red-100 border-red-300 text-red-900",
];

export default function TimetablePage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // State
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Filters
  const [selectedDay, setSelectedDay] = useState("All");
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedTeacher, setSelectedTeacher] = useState("All");

  // Master data
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    classId: "",
    subjectId: "",
    teacherId: "",
    dayOfWeek: "Monday",
    periodNumber: 1,
    startTime: "08:00",
    endTime: "08:45",
    effectiveFrom: new Date().toISOString().split("T")[0],
  });

  // Teacher color mapping
  const [teacherColorMap, setTeacherColorMap] = useState({});

  useEffect(() => {
    fetchMasterData();
    fetchTimetable();
  }, []);

  useEffect(() => {
    // Assign colors to teachers
    const colorMap = {};
    teachers.forEach((teacher, index) => {
      colorMap[teacher.id] = TEACHER_COLORS[index % TEACHER_COLORS.length];
    });
    setTeacherColorMap(colorMap);
  }, [teachers]);

  const fetchMasterData = async () => {
    try {
      const [classesRes, subjectsRes, teachersRes] = await Promise.all([
        classesAPI.list(),
        subjectsAPI.list(),
        usersAPI.list({ role: "Teacher" }),
      ]);

      setClasses(classesRes.data.classes || []);
      setSubjects(subjectsRes.data.subjects || []);
      setTeachers(teachersRes.data.users || []);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: "Failed to load master data",
        variant: "destructive",
      });
    }
  };

  const fetchTimetable = async () => {
    try {
      setLoading(true);
      const params = { status: "Active" };

      if (selectedDay !== "All") {
        params.dayOfWeek = selectedDay;
      }
      if (selectedClass !== "All") {
        params.classId = selectedClass;
      }
      if (selectedTeacher !== "All") {
        params.teacherId = selectedTeacher;
      }

      const response = await timetableAPI.get(params);
      setTimetable(response.data.timetable || []);
    } catch (error) {
      console.error("Error fetching timetable:", error);
      toast({
        title: "Error",
        description: "Failed to load timetable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimeSlot = async () => {
    try {
      setCreating(true);

      await timetableAPI.create(formData);

      toast({
        title: "Success",
        description: "TimeSlot created successfully",
      });

      setDialogOpen(false);
      setFormData({
        classId: "",
        subjectId: "",
        teacherId: "",
        dayOfWeek: "Monday",
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
        effectiveFrom: new Date().toISOString().split("T")[0],
      });

      fetchTimetable();
    } catch (error) {
      console.error("Error creating timeslot:", error);
      const message =
        error.response?.data?.error?.message || "Failed to create timeslot";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEndTimeSlot = async (timeSlotId) => {
    if (
      !window.confirm("Are you sure you want to end this timeslot assignment?")
    ) {
      return;
    }

    try {
      await timetableAPI.end(timeSlotId, {
        effectiveTo: new Date().toISOString().split("T")[0],
      });

      toast({
        title: "Success",
        description: "TimeSlot ended successfully",
      });

      fetchTimetable();
    } catch (error) {
      console.error("Error ending timeslot:", error);
      const message =
        error.response?.data?.error?.message || "Failed to end timeslot";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const getTimeSlotForCell = (day, period) => {
    return timetable.find(
      (slot) => slot.day_of_week === day && slot.period_number === period,
    );
  };

  const renderGridView = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-100 font-semibold min-w-[100px]">
                Period
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="border p-2 bg-gray-100 font-semibold min-w-[150px]"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <td className="border p-2 bg-gray-50 font-medium text-center">
                  P{period}
                </td>
                {DAYS.map((day) => {
                  const slot = getTimeSlotForCell(day, period);
                  return (
                    <td
                      key={`${day}-${period}`}
                      className="border p-2 align-top"
                    >
                      {slot ? (
                        <div
                          className={`p-2 rounded border ${teacherColorMap[slot.teacher_id] || "bg-gray-100 border-gray-300"}`}
                        >
                          <div className="font-semibold text-sm">
                            {slot.subject_name}
                          </div>
                          <div className="text-xs">{slot.class_name}</div>
                          <div className="text-xs mt-1">
                            {slot.teacher_name}
                          </div>
                          {slot.start_time && (
                            <div className="text-xs text-muted-foreground">
                              {slot.start_time} - {slot.end_time}
                            </div>
                          )}
                          {isAdmin() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 text-xs"
                              onClick={() => handleEndTimeSlot(slot.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              End
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          Empty
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-3">
        {timetable.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No timeslots found
          </div>
        ) : (
          timetable.map((slot) => (
            <div
              key={slot.id}
              className={`p-4 rounded-lg border ${teacherColorMap[slot.teacher_id] || "bg-gray-50 border-gray-300"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg">
                      {slot.subject_name}
                    </span>
                    <span className="text-xs bg-white/50 px-2 py-0.5 rounded">
                      {slot.day_of_week} P{slot.period_number}
                    </span>
                  </div>
                  <div className="text-sm">{slot.class_name}</div>
                  <div className="text-sm mt-1">
                    Teacher: {slot.teacher_name}
                  </div>
                  {slot.start_time && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {slot.start_time} - {slot.end_time}
                    </div>
                  )}
                </div>
                {isAdmin() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEndTimeSlot(slot.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground">
            {isAdmin() ? "Manage class schedules" : "View class schedules"}
          </p>
        </div>
        {isAdmin() && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create TimeSlot
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create TimeSlot</DialogTitle>
                <DialogDescription>
                  Add a new timeslot to the timetable
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="class">Class *</Label>
                  <Select
                    value={formData.classId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, classId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={formData.subjectId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, subjectId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="teacher">Teacher *</Label>
                  <Select
                    value={formData.teacherId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, teacherId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="day">Day *</Label>
                    <Select
                      value={formData.dayOfWeek}
                      onValueChange={(value) =>
                        setFormData({ ...formData, dayOfWeek: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="period">Period *</Label>
                    <Select
                      value={formData.periodNumber.toString()}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          periodNumber: parseInt(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODS.map((period) => (
                          <SelectItem key={period} value={period.toString()}>
                            Period {period}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData({ ...formData, startTime: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) =>
                        setFormData({ ...formData, endTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="effectiveFrom">Effective From *</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        effectiveFrom: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTimeSlot} disabled={creating}>
                  {creating ? "Creating..." : "Create TimeSlot"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Days</SelectItem>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin() && (
              <>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Teacher</Label>
                  <Select
                    value={selectedTeacher}
                    onValueChange={setSelectedTeacher}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Teachers</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-end">
              <Button
                onClick={fetchTimetable}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timetable Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Timetable</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : `${timetable.length} timeslot(s) scheduled`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading timetable...
            </div>
          ) : (
            <>
              <div className="hidden lg:block">{renderGridView()}</div>
              <div className="lg:hidden">{renderListView()}</div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

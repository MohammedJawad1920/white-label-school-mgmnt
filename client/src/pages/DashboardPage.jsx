import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { timetableAPI } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, Users, BookOpen } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [todayClasses, setTodayClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayClasses();
  }, []);

  const fetchTodayClasses = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const dayOfWeek = format(new Date(), "EEEE");

      const response = await timetableAPI.get({
        date: today,
        dayOfWeek: dayOfWeek,
        teacherId: user.id,
      });

      setTodayClasses(response.data.timetable || []);
    } catch (error) {
      console.error("Error fetching today classes:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(new Date(), "MMM d, yyyy")}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "EEEE")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes Today</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : todayClasses.length}
            </div>
            <p className="text-xs text-muted-foreground">Scheduled periods</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.roles?.[0]}</div>
            <p className="text-xs text-muted-foreground">
              {user?.roles?.join(", ")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(new Date(), "HH:mm")}
            </div>
            <p className="text-xs text-muted-foreground">Local time</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Classes */}
      <Card>
        <CardHeader>
          <CardTitle>My Classes Today</CardTitle>
          <CardDescription>
            Your teaching schedule for {format(new Date(), "EEEE, MMMM d")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading classes...
            </div>
          ) : todayClasses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No classes scheduled for today
            </div>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg px-3 py-2">
                      <span className="text-xs font-medium text-primary">
                        Period
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {classItem.periodNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{classItem.subjectName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {classItem.className}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {classItem.startTime || "--:--"} -{" "}
                      {classItem.endTime || "--:--"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {classItem.dayOfWeek}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {isAdmin() && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
                <h4 className="font-semibold mb-1">Manage Students</h4>
                <p className="text-xs text-muted-foreground">
                  Add or edit student records
                </p>
              </button>
              <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
                <h4 className="font-semibold mb-1">View Reports</h4>
                <p className="text-xs text-muted-foreground">
                  Attendance and performance reports
                </p>
              </button>
              <button className="p-4 border rounded-lg hover:bg-accent text-left transition-colors">
                <h4 className="font-semibold mb-1">Manage Timetable</h4>
                <p className="text-xs text-muted-foreground">
                  Edit class schedules
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { featuresAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Calendar,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

const FEATURE_ICONS = {
  timetable: Calendar,
  attendance: ClipboardCheck,
};

export default function FeaturesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const response = await featuresAPI.list();
      setFeatures(response.data.features || []);
    } catch (error) {
      console.error("Error fetching features:", error);
      toast({
        title: "Error",
        description: "Failed to load features",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (featureKey, currentEnabled) => {
    const newEnabled = !currentEnabled;

    try {
      setUpdating((prev) => ({ ...prev, [featureKey]: true }));

      await featuresAPI.update(featureKey, { enabled: newEnabled });

      // Update local state
      setFeatures((prev) =>
        prev.map((f) =>
          f.key === featureKey
            ? {
                ...f,
                enabled: newEnabled,
                enabledAt: newEnabled ? new Date().toISOString() : null,
              }
            : f,
        ),
      );

      // Special handling: If disabling timetable, attendance auto-disables
      if (featureKey === "timetable" && !newEnabled) {
        setFeatures((prev) =>
          prev.map((f) =>
            f.key === "attendance"
              ? { ...f, enabled: false, enabledAt: null }
              : f,
          ),
        );
      }

      toast({
        title: "Success",
        description: `${features.find((f) => f.key === featureKey)?.name} ${
          newEnabled ? "enabled" : "disabled"
        }`,
      });
    } catch (error) {
      console.error("Error updating feature:", error);
      const message =
        error.response?.data?.error?.message || "Failed to update feature";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdating((prev) => ({ ...prev, [featureKey]: false }));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const timetableFeature = features.find((f) => f.key === "timetable");
  const attendanceFeature = features.find((f) => f.key === "attendance");
  const isTimetableEnabled = timetableFeature?.enabled || false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Feature Management
        </h1>
        <p className="text-muted-foreground">
          Enable or disable modules for your school
        </p>
      </div>

      {/* Dependency Warning */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-900">
                Feature Dependencies
              </p>
              <p className="text-sm text-blue-700">
                Attendance module requires Timetable to be enabled first.
                Disabling Timetable will automatically disable Attendance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {features.map((feature) => {
          const Icon = FEATURE_ICONS[feature.key] || Settings;
          const isEnabled = feature.enabled;
          const isUpdating = updating[feature.key];

          // Disable attendance toggle if timetable is disabled
          const isDisabled =
            feature.key === "attendance" && !isTimetableEnabled;

          return (
            <Card
              key={feature.key}
              className={
                isEnabled
                  ? "border-green-200 bg-green-50"
                  : isDisabled
                    ? "border-gray-200 bg-gray-50 opacity-60"
                    : "border-gray-200"
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isEnabled
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {feature.name}
                        {isEnabled ? (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium">
                        {isEnabled ? "Module Active" : "Module Inactive"}
                      </p>
                      {isEnabled && feature.enabledAt && (
                        <p className="text-sm text-muted-foreground">
                          Enabled on{" "}
                          {format(new Date(feature.enabledAt), "MMM d, yyyy")}
                        </p>
                      )}
                      {isDisabled && (
                        <p className="text-sm text-red-600">
                          Requires Timetable to be enabled first
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() =>
                        handleToggle(feature.key, isEnabled)
                      }
                      disabled={isUpdating || isDisabled}
                    />
                  </div>

                  {/* Key Features */}
                  <div className="p-4 bg-white rounded-lg border">
                    <p className="font-medium mb-2">Key Features:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {feature.key === "timetable" && (
                        <>
                          <li>• Create and manage class schedules</li>
                          <li>• Assign teachers to time slots</li>
                          <li>• View weekly timetables</li>
                          <li>• Track teacher assignments</li>
                        </>
                      )}
                      {feature.key === "attendance" && (
                        <>
                          <li>• Record student attendance</li>
                          <li>• View attendance history</li>
                          <li>• Generate monthly reports</li>
                          <li>• Track attendance rates</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Module Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Total Modules</span>
              <Badge>{features.length}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="font-medium">Enabled Modules</span>
              <Badge variant="success">
                {features.filter((f) => f.enabled).length}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Disabled Modules</span>
              <Badge variant="secondary">
                {features.filter((f) => !f.enabled).length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

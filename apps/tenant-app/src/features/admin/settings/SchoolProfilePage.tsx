/**
 * SchoolProfilePage — v5.0 M-017
 *
 * Route: /admin/settings/profile (Admin only)
 * API:
 *   GET  /school-profile          — fetch profile
 *   PUT  /school-profile          — update profile fields
 *   POST /school-profile/upload   — upload logo / principal signature
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { schoolProfileApi } from "@/api/schoolProfile";
import { parseApiError } from "@/utils/errors";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { UpdateSchoolProfileRequest } from "@/types/api";

// Valid student levels — mirrors VALID_LEVELS on server (M-017)
const VALID_LEVELS = [
  "Nursery",
  "KG1",
  "KG2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;

const profileSchema = z.object({
  address: z.string().max(500).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z
    .string()
    .max(254)
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  website: z.string().max(2048).optional().or(z.literal("")),
  brandingColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #1A5276")
    .optional()
    .or(z.literal("")),
  principalName: z.string().max(200).optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SchoolProfilePage() {
  const qc = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [levelsInitialized, setLevelsInitialized] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.schoolProfile(),
    queryFn: () => schoolProfileApi.get(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
  });

  // Initialize form + levels when data loads
  if (profile && !levelsInitialized) {
    reset({
      address: profile.address ?? "",
      phone: profile.phone ?? "",
      email: profile.email ?? "",
      website: profile.website ?? "",
      brandingColor: profile.brandingColor ?? "",
      principalName: profile.principalName ?? "",
    });
    setSelectedLevels(profile.activeLevels ?? []);
    setLevelsInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateSchoolProfileRequest) =>
      schoolProfileApi.update(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.schoolProfile() });
      toast.success("School profile updated");
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      field,
    }: {
      file: File;
      field: "logoUrl" | "principalSignatureUrl";
    }) =>
      schoolProfileApi.uploadFile(file).then((r) => ({ url: r.url, field })),
    onSuccess: ({ url, field }) => {
      updateMutation.mutate({ [field]: url });
      toast.success(
        field === "logoUrl" ? "Logo uploaded" : "Signature uploaded",
      );
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  function onSubmit(values: ProfileFormValues) {
    const payload: UpdateSchoolProfileRequest = {
      address: values.address || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      brandingColor: values.brandingColor || null,
      principalName: values.principalName || null,
      activeLevels: selectedLevels.length > 0 ? selectedLevels : null,
    };
    updateMutation.mutate(payload);
  }

  function toggleLevel(level: string) {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {parseApiError(error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">School Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          School name, branding, and contact information
        </p>
      </div>

      {/* Logo */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium">School logo</h2>
        <div className="flex items-center gap-4">
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="School logo"
              className="h-16 w-16 object-contain rounded-lg border bg-muted"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-xs">
              No logo
            </div>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate({ file, field: "logoUrl" });
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload logo"}
            </button>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, SVG — max 2 MB
            </p>
          </div>
        </div>
      </div>

      {/* Main form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Contact info */}
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-medium">Contact information</h2>
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium mb-1.5"
            >
              Address
            </label>
            <textarea
              id="address"
              rows={3}
              aria-invalid={errors.address ? true : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive resize-none"
              {...register("address")}
            />
            {errors.address && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium mb-1.5"
              >
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("phone")}
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                aria-invalid={errors.email ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("email")}
              />
              {errors.email && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="website"
              className="block text-sm font-medium mb-1.5"
            >
              Website
            </label>
            <input
              id="website"
              type="url"
              placeholder="https://"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("website")}
            />
          </div>
        </div>

        {/* Branding */}
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-medium">Branding</h2>
          <div>
            <label
              htmlFor="brandingColor"
              className="block text-sm font-medium mb-1.5"
            >
              Brand color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="brandingColor"
                type="text"
                placeholder="#1A5276"
                maxLength={7}
                aria-invalid={errors.brandingColor ? true : undefined}
                className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("brandingColor")}
              />
              <p className="text-xs text-muted-foreground">Hex e.g. #1A5276</p>
            </div>
            {errors.brandingColor && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                {errors.brandingColor.message}
              </p>
            )}
          </div>
        </div>

        {/* Principal */}
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-medium">Principal</h2>
          <div>
            <label
              htmlFor="principalName"
              className="block text-sm font-medium mb-1.5"
            >
              Principal name
            </label>
            <input
              id="principalName"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("principalName")}
            />
          </div>
          {/* Signature upload */}
          <div>
            <p className="block text-sm font-medium mb-1.5">
              Principal signature
            </p>
            <div className="flex items-center gap-4">
              {profile?.principalSignatureUrl ? (
                <img
                  src={profile.principalSignatureUrl}
                  alt="Principal signature"
                  className="h-12 object-contain rounded border bg-muted"
                />
              ) : (
                <div className="h-12 w-32 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  No signature
                </div>
              )}
              <div>
                <input
                  ref={sigInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      uploadMutation.mutate({
                        file,
                        field: "principalSignatureUrl",
                      });
                  }}
                />
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Upload signature
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active levels */}
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-medium">Active grade levels</h2>
          <p className="text-xs text-muted-foreground">
            Select the grade levels offered by this school.
          </p>
          <div className="flex flex-wrap gap-2">
            {VALID_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selectedLevels.includes(level)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || isSubmitting || updateMutation.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

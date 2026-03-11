/**
 * EventsPage — Freeze §Screen: Events Management (v4.5 CR-37 / CR-FE-016g)
 *
 * Route:  /manage/events  (Admin only)
 * API:
 *   GET    /api/events             — list current-month events
 *   POST   /api/events             — create
 *   PUT    /api/events/:eventId    — update
 *   DELETE /api/events/:eventId    — soft-delete (204)
 *
 * TQ key: ['events', 'manage']  stale: 5 min
 *
 * Form validation (client-side mirrors backend):
 *   title:       required, max 200
 *   type:        required, one of Holiday | Exam | Event | Other
 *   startDate:   required, YYYY-MM-DD
 *   endDate:     required, YYYY-MM-DD, must be >= startDate
 *   description: optional, max 2000
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { eventsApi } from "@/api/events";
import { parseApiError } from "@/utils/errors";
import { toast } from "sonner";
import { formatDisplayDate } from "@/utils/dates";
import {
  TableSkeleton,
  Drawer,
  FormField,
  SubmitFooter,
  PageHeader,
  RootError,
  ConfirmDialog,
  inputCls,
} from "@/components/manage/shared";
import type { Event, EventType } from "@/types/api";

// ── Zod schema ─────────────────────────────────────────────────────────────────
const EVENT_TYPES: [EventType, ...EventType[]] = [
  "Holiday",
  "Exam",
  "Event",
  "Other",
];

const schema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Max 200 characters"),
    type: z.enum(EVENT_TYPES, { required_error: "Type is required" }),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    description: z
      .string()
      .max(2000, "Max 2000 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date.",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

// ── Type badge colour ──────────────────────────────────────────────────────────
function typeBadgeCls(type: EventType): string {
  switch (type) {
    case "Holiday":
      return "bg-red-100 text-red-700";
    case "Exam":
      return "bg-amber-100 text-amber-700";
    case "Event":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ── Event form ─────────────────────────────────────────────────────────────────
function EventForm({
  defaultValues,
  isEdit,
  onSubmit,
  isPending,
  rootError,
  onClose,
}: {
  defaultValues: Partial<FormValues>;
  isEdit: boolean;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
  rootError: string | null;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "Event",
      startDate: "",
      endDate: "",
      description: "",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}

        <FormField
          id="evTitle"
          label="Title"
          error={errors.title?.message}
          required
        >
          <input
            id="evTitle"
            type="text"
            maxLength={200}
            className={inputCls(!!errors.title)}
            aria-invalid={!!errors.title}
            {...register("title")}
          />
        </FormField>

        <FormField
          id="evType"
          label="Type"
          error={errors.type?.message}
          required
        >
          <select
            id="evType"
            className={inputCls(!!errors.type)}
            aria-invalid={!!errors.type}
            {...register("type")}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="evStart"
            label="Start Date"
            error={errors.startDate?.message}
            required
          >
            <input
              id="evStart"
              type="date"
              className={inputCls(!!errors.startDate)}
              aria-invalid={!!errors.startDate}
              {...register("startDate")}
            />
          </FormField>

          <FormField
            id="evEnd"
            label="End Date"
            error={errors.endDate?.message}
            required
          >
            <input
              id="evEnd"
              type="date"
              className={inputCls(!!errors.endDate)}
              aria-invalid={!!errors.endDate}
              {...register("endDate")}
            />
          </FormField>
        </div>

        <FormField
          id="evDesc"
          label="Description (optional)"
          error={errors.description?.message}
        >
          <textarea
            id="evDesc"
            rows={3}
            maxLength={2000}
            className={inputCls(!!errors.description)}
            aria-invalid={!!errors.description}
            {...register("description")}
          />
        </FormField>
      </div>

      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onClose}
          isLoading={isPending}
          submitLabel={isEdit ? "Save Changes" : "Create Event"}
        />
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EventType | "">("");

  // ── Queries ─────────────────────────────────────────────────────────────────
  const eventsQ = useQuery({
    queryKey: ["events", "manage"],
    queryFn: () => eventsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const events = eventsQ.data?.events ?? [];

  const filteredEvents = useMemo(
    () =>
      events.filter((ev) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          ev.title.toLowerCase().includes(q) ||
          (ev.description ?? "").toLowerCase().includes(q);
        const matchesType = !typeFilter || ev.type === typeFilter;
        return matchesSearch && matchesType;
      }),
    [events, searchQuery, typeFilter],
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: FormValues) =>
      eventsApi.create({
        title: data.title,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || null,
      }),
    onSuccess: async () => {
      setDrawerOpen(false);
      setRootError(null);
      toast.success("Event created successfully.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      setRootError(parseApiError(err).message);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormValues }) =>
      eventsApi.update(id, {
        title: data.title,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || null,
      }),
    onSuccess: async () => {
      setDrawerOpen(false);
      setEditEvent(null);
      setRootError(null);
      toast.success("Event updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      setRootError(parseApiError(err).message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (eventId: string) => eventsApi.remove(eventId),
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success("Event deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      setDeleteTarget(null);
      toast.error("Something went wrong. Please try again.");
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditEvent(null);
    setRootError(null);
    setDrawerOpen(true);
  }

  function openEdit(ev: Event) {
    setEditEvent(ev);
    setRootError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditEvent(null);
    setRootError(null);
  }

  function handleSubmit(values: FormValues) {
    if (editEvent) {
      updateMut.mutate({ id: editEvent.id, data: values });
    } else {
      createMut.mutate(values);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Events"
        subtitle="Academic calendar: holidays, exams, and school events"
        onAdd={openCreate}
        addLabel="+ New Event"
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events…"
          aria-label="Search events"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-52"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EventType | "")}
          aria-label="Filter by type"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {eventsQ.isLoading && <TableSkeleton rows={5} cols={4} />}

      {/* Error */}
      {eventsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
        >
          {parseApiError(eventsQ.error).message ?? "Failed to load events."}
        </div>
      )}

      {/* Empty */}
      {!eventsQ.isLoading && !eventsQ.isError && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="h-12 w-12 text-muted-foreground/40 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">
            No events yet. Click <strong>+ New Event</strong> to add one.
          </p>
        </div>
      )}

      {/* Events table */}
      {!eventsQ.isLoading && !eventsQ.isError && events.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div role="table" aria-label="Events" className="w-full text-sm">
            {/* Header */}
            <div
              role="row"
              className="flex bg-muted/50 border-b font-medium text-xs text-muted-foreground"
            >
              <div role="columnheader" className="flex-1 px-4 py-2.5">
                Title
              </div>
              <div role="columnheader" className="w-24 px-3 py-2.5">
                Type
              </div>
              <div role="columnheader" className="w-36 px-3 py-2.5">
                Dates
              </div>
              <div
                role="columnheader"
                className="w-24 px-3 py-2.5 text-right"
                aria-label="Actions"
              />
            </div>

            {/* Rows */}
            {filteredEvents.length === 0 ? (
              <div
                role="row"
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                No events match your filters.
              </div>
            ) : (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  role="row"
                  className="flex items-center border-b last:border-b-0 hover:bg-muted/20"
                >
                  <div role="cell" className="flex-1 px-4 py-3 min-w-0">
                    <p className="font-medium truncate">{ev.title}</p>
                    {ev.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  <div role="cell" className="w-24 px-3 py-3 shrink-0">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${typeBadgeCls(ev.type)}`}
                    >
                      {ev.type}
                    </span>
                  </div>

                  <div
                    role="cell"
                    className="w-36 px-3 py-3 shrink-0 text-xs text-muted-foreground"
                  >
                    {ev.startDate === ev.endDate ? (
                      <span>{formatDisplayDate(ev.startDate)}</span>
                    ) : (
                      <span>
                        {formatDisplayDate(ev.startDate)}
                        <br />
                        {formatDisplayDate(ev.endDate)}
                      </span>
                    )}
                  </div>

                  <div
                    role="cell"
                    className="w-24 px-3 py-3 shrink-0 flex justify-end gap-1.5"
                  >
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(ev)}
                      aria-label={`Edit event: ${ev.title}`}
                      className="rounded border px-2 py-1 text-xs hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Edit
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTarget(ev)}
                      aria-label={`Delete event: ${ev.title}`}
                      className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    >
                      Delete
                    </button>{" "}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        title={editEvent ? "Edit Event" : "New Event"}
        onClose={closeDrawer}
        footer={null}
      >
        <EventForm
          key={editEvent?.id ?? "create"}
          isEdit={!!editEvent}
          defaultValues={
            editEvent
              ? {
                  title: editEvent.title,
                  type: editEvent.type,
                  startDate: editEvent.startDate,
                  endDate: editEvent.endDate,
                  description: editEvent.description ?? "",
                }
              : {}
          }
          onSubmit={handleSubmit}
          isPending={isPending}
          rootError={rootError}
          onClose={closeDrawer}
        />
      </Drawer>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Event"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.title}"? This cannot be undone.`
            : ""
        }
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

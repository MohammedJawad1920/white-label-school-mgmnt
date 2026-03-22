import { create } from "zustand";
import { studentsApi } from "@/api/students";

interface StudentStoreState {
  classId: string | null;
  batchId: string | null;
  isLoading: boolean;
  error: string | null;
  hydrateFromStudentId: (studentId: string) => Promise<void>;
  clear: () => void;
}

export const useStudentStore = create<StudentStoreState>((set) => ({
  classId: null,
  batchId: null,
  isLoading: false,
  error: null,
  hydrateFromStudentId: async (studentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await studentsApi.getById(studentId);
      set({
        classId: result.student.classId ?? null,
        batchId: result.student.batchId,
        isLoading: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load student profile";
      set({ isLoading: false, error: message, classId: null, batchId: null });
    }
  },
  clear: () =>
    set({ classId: null, batchId: null, isLoading: false, error: null }),
}));

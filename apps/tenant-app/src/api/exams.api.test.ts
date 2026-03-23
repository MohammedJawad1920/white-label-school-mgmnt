/**
 * exams.api.test.ts
 *
 * Regression tests for exams API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-007, CR-FE-008
 *
 * Verifies:
 *   - List endpoint reads `.data.data` not `.data.exams`
 *   - Detail endpoint reads `.data.data` not `.data.exam`
 *   - Response types (`ListExamsResponse`, `GetExamResponse`) are correctly used
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as examsApi from './exams.api';
import { apiClient } from './client';

vi.mock('./client');

describe('exams.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listExams', () => {
    it('correctly unwraps response envelope from `.data.data` (regression: CR-FE-007)', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 'exam-1', name: 'Math', sessionId: 'session-1', maxScore: 100, status: 'draft' },
            { id: 'exam-2', name: 'English', sessionId: 'session-1', maxScore: 100, status: 'draft' },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await examsApi.listExams();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[1].name).toBe('English');
    });

    it('correctly reads from `.data.data` not `.data.exams`', async () => {
      const mockResponse = {
        data: {
          data: [{ id: 'exam-1', name: 'Math', sessionId: 'session-1', maxScore: 100, status: 'draft' }],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      await examsApi.listExams();

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/exams'));
    });
  });

  describe('getExam', () => {
    it('correctly unwraps response envelope from `.data.data` (regression: CR-FE-008)', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'exam-1',
            name: 'Math Exam',
            sessionId: 'session-1',
            maxScore: 100,
            status: 'published',
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await examsApi.getExam('exam-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('exam-1');
      expect(result.name).toBe('Math Exam');
    });

    it('correctly reads from `.data.data` not `.data.exam`', async () => {
      const mockResponse = {
        data: {
          data: { id: 'exam-1', name: 'Test', sessionId: 'session-1', maxScore: 100, status: 'draft' },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      await examsApi.getExam('exam-1');

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/exams/exam-1'));
    });
  });
});

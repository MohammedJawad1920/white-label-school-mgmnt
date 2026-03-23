/**
 * notifications.api.test.ts
 *
 * Regression tests for notifications API client (Freeze v3.3 §10.1)
 * Targets: CR-FE-004, CR-FE-005
 *
 * Verifies:
 *   - List endpoint reads `.data.data` not `.data.notifications`
 *   - `markAllRead` endpoint reads `.data.updated` not `.data.updatedCount`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as notificationsApi from './notifications.api';
import { apiClient } from './client';

vi.mock('./client');

describe('notifications.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listNotifications', () => {
    it('correctly unwraps response envelope from `.data.data` (regression: CR-FE-004)', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 'notif-1', message: 'Leave approved', type: 'leave', readAt: null },
            { id: 'notif-2', message: 'Exam published', type: 'exam', readAt: null },
          ],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await notificationsApi.listNotifications();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].message).toBe('Leave approved');
    });

    it('correctly reads from `.data.data` not `.data.notifications`', async () => {
      const mockResponse = {
        data: {
          data: [{ id: 'notif-1', message: 'Test', type: 'leave', readAt: null }],
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);
      await notificationsApi.listNotifications();

      expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/notifications'));
    });
  });

  describe('markAllRead', () => {
    it('correctly reads `.data.updated` not `.data.updatedCount` (regression: CR-FE-005)', async () => {
      const mockResponse = {
        data: {
          updated: 5,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await notificationsApi.markAllRead();

      expect(typeof result).toBe('number');
      expect(result).toBe(5);
    });

    it('sends POST request to mark-all-read endpoint', async () => {
      const mockResponse = {
        data: {
          updated: 3,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);
      await notificationsApi.markAllRead();

      expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining('/notifications/mark-all-read'));
    });
  });
});

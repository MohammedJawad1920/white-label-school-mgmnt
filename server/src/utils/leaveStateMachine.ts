/**
 * Leave Request State Machine
 *
 * Pure functions for validating leave state transitions.
 * Extracted for unit testability per Freeze v6.1 §13.4.
 *
 * State diagram:
 *   PENDING  → APPROVED   (approveLeave)
 *   PENDING  → REJECTED   (rejectLeave)
 *   PENDING  → CANCELLED  (cancelLeave)
 *   APPROVED → ACTIVE     (departLeave)
 *   ACTIVE   → OVERDUE    (cron job when past expected_return_at)
 *   ACTIVE   → COMPLETED  (returnLeave)
 *   OVERDUE  → COMPLETED  (returnLeave)
 */

export type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "ACTIVE"
  | "OVERDUE"
  | "COMPLETED";

export type LeaveAction =
  | "approve"
  | "reject"
  | "cancel"
  | "depart"
  | "return"
  | "mark_overdue";

/**
 * Valid transitions map: fromStatus → allowed actions
 */
const VALID_TRANSITIONS: Record<LeaveStatus, LeaveAction[]> = {
  PENDING: ["approve", "reject", "cancel"],
  APPROVED: ["depart"],
  REJECTED: [],
  CANCELLED: [],
  ACTIVE: ["return", "mark_overdue"],
  OVERDUE: ["return"],
  COMPLETED: [],
};

/**
 * Target status for each action
 */
const ACTION_TARGET: Record<LeaveAction, LeaveStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
  cancel: "CANCELLED",
  depart: "ACTIVE",
  return: "COMPLETED",
  mark_overdue: "OVERDUE",
};

/**
 * Checks if a transition is valid.
 *
 * @param currentStatus - The current leave status
 * @param action - The action being attempted
 * @returns true if the transition is allowed
 */
export function isValidTransition(
  currentStatus: LeaveStatus,
  action: LeaveAction,
): boolean {
  return VALID_TRANSITIONS[currentStatus].includes(action);
}

/**
 * Gets the target status for an action.
 *
 * @param action - The action being performed
 * @returns The resulting status after the action
 */
export function getTargetStatus(action: LeaveAction): LeaveStatus {
  return ACTION_TARGET[action];
}

/**
 * Validates a transition and returns the result.
 *
 * @param currentStatus - The current leave status
 * @param action - The action being attempted
 * @returns Object with isValid, targetStatus, and error code if invalid
 */
export function validateTransition(
  currentStatus: LeaveStatus,
  action: LeaveAction,
): {
  isValid: boolean;
  targetStatus?: LeaveStatus;
  errorCode?: string;
  errorMessage?: string;
} {
  if (!isValidTransition(currentStatus, action)) {
    // Determine specific error code based on the scenario
    let errorCode = "INVALID_TRANSITION";
    let errorMessage = `Cannot ${action} a leave request with status ${currentStatus}`;

    // Special cases for more specific error codes
    if (
      (action === "approve" || action === "reject") &&
      currentStatus !== "PENDING"
    ) {
      errorCode = "LEAVE_ALREADY_REVIEWED";
      errorMessage = "This leave request has already been reviewed";
    }

    if (action === "depart" && currentStatus !== "APPROVED") {
      errorCode = "LEAVE_NOT_APPROVED";
      errorMessage = "Leave must be approved before departure can be recorded";
    }

    if (
      action === "return" &&
      currentStatus !== "ACTIVE" &&
      currentStatus !== "OVERDUE"
    ) {
      errorCode = "LEAVE_NOT_ACTIVE";
      errorMessage = "Student must be on active leave to record return";
    }

    return { isValid: false, errorCode, errorMessage };
  }

  return { isValid: true, targetStatus: ACTION_TARGET[action] };
}

/**
 * Gets all allowed actions for a given status.
 *
 * @param status - The current leave status
 * @returns Array of allowed actions
 */
export function getAllowedActions(status: LeaveStatus): LeaveAction[] {
  return [...VALID_TRANSITIONS[status]];
}

/**
 * Checks if a leave request is in a terminal state (no further transitions).
 *
 * @param status - The leave status to check
 * @returns true if no further actions are possible
 */
export function isTerminalState(status: LeaveStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * Checks if a leave request can still be cancelled.
 *
 * @param status - The current status
 * @returns true if cancellation is possible
 */
export function canCancel(status: LeaveStatus): boolean {
  return status === "PENDING";
}

/**
 * Checks if a leave request is currently active (student is on leave).
 *
 * @param status - The current status
 * @returns true if student is physically on leave
 */
export function isOnLeave(status: LeaveStatus): boolean {
  return status === "ACTIVE" || status === "OVERDUE";
}

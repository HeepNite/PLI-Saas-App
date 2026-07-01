import { describe, expect, it, vi } from "vitest"

import { buildStaffUsersAdminViewProps } from "@/components/front/staff/buildStaffUsersAdminViewProps"

describe("buildStaffUsersAdminViewProps", () => {
  it("builds view callbacks that preserve the existing container semantics", async () => {
    const handleNavSelection = vi.fn()
    const setPaymentHistoryStudentId = vi.fn()
    const setPaymentHistoryAnchor = vi.fn()
    const setAttendanceHistoryStudentId = vi.fn()
    const setAttendanceHistoryAnchor = vi.fn()
    const setAuditHistoryAnchor = vi.fn()
    const setAuditHistoryStudentId = vi.fn()
    const setAuditHistoryStudentName = vi.fn()
    const markUserHasAuditEntries = vi.fn()
    const refreshPaymentsBoard = vi.fn().mockResolvedValue(undefined)
    const setError = vi.fn()
    const updateStaffPayrollModel = vi.fn().mockResolvedValue(undefined)
    const openProfileModal = vi.fn().mockResolvedValue(undefined)
    const runAction = vi.fn().mockResolvedValue(undefined)
    const revokeStaff = vi.fn().mockResolvedValue(undefined)
    const saveTeacherPerformance = vi.fn().mockResolvedValue(undefined)

    const props = buildStaffUsersAdminViewProps({
      shell: {
        gridRef: { current: null },
        leftRailRef: { current: null },
        reserveAssistantColumn: false,
        visibleNavItems: [],
        activeNav: "users",
        handleNavSelection,
      },
      boards: {
        profileView: {} as never,
        accessCreate: {
          showStaffOps: true,
          form: {} as never,
          assignableRoles: [],
          status: {} as never,
          createStaff: vi.fn(),
        },
        utilityPanels: {} as never,
        teamBoard: {
          showStaffOps: true,
          filters: {} as never,
          search: {} as never,
          data: {} as never,
          currentUserId: "user_1",
          canManageTarget: (() => true) as never,
          setError,
          payrollModels: {
            options: [],
            loading: false,
            error: null,
            actionByUserId: {},
            updateStaffPayrollModel,
          },
          presence: {} as never,
          openProfileModal: openProfileModal as never,
          openDelayDetails: vi.fn() as never,
          runAction,
          revokeStaff,
        },
        teacherAssignment: {
          showStaffOps: true,
          selection: {} as never,
          recurrence: {} as never,
          courses: {} as never,
          status: {} as never,
          saveTeacherPerformance,
        },
        schoolWorkspace: {} as never,
        payrollControl: {} as never,
        studentsBoard: {} as never,
        reports: {} as never,
        approvals: {} as never,
        teamCalendar: {} as never,
        performanceMetrics: {} as never,
      },
      assistant: { rightRail: {} as never, content: {} as never },
      modals: { adminModalOverlays: {} as never, profileModal: {} as never, assignableRoles: [], adminHistoryOverlays: {} as never },
      actions: {
        handleNavSelection,
        setPaymentHistoryStudentId,
        setPaymentHistoryAnchor,
        setAttendanceHistoryStudentId,
        setAttendanceHistoryAnchor,
        setAuditHistoryAnchor,
        setAuditHistoryStudentId,
        setAuditHistoryStudentName,
        markUserHasAuditEntries,
        refreshPaymentsBoard,
      },
      formatters: { resolveHistoryDateIso: () => "2026-05-31" },
      statusBanners: { currentRole: "owner" },
    })

    props.actions.onOpenAssistantConfig()
    expect(handleNavSelection).toHaveBeenCalledWith("assistant")

    props.actions.onClosePaymentHistory()
    expect(setPaymentHistoryStudentId).toHaveBeenCalledWith(null)
    expect(setPaymentHistoryAnchor).toHaveBeenCalledWith(null)

    props.actions.onCloseAttendanceHistory()
    expect(setAttendanceHistoryStudentId).toHaveBeenCalledWith(null)
    expect(setAttendanceHistoryAnchor).toHaveBeenCalledWith(null)

    props.actions.onCloseAuditHistory()
    expect(setAuditHistoryAnchor).toHaveBeenCalledWith(null)
    expect(setAuditHistoryStudentId).toHaveBeenCalledWith(null)
    expect(setAuditHistoryStudentName).toHaveBeenCalledWith(null)

    props.actions.onOverrideSuccess("student_1")
    expect(markUserHasAuditEntries).toHaveBeenCalledWith("student_1")
    expect(refreshPaymentsBoard).toHaveBeenCalledTimes(1)

    props.boards.teamBoard.payrollModels.updateModel("user_1", "model_1")
    props.boards.teamBoard.actions.openProfile({ id: "row_1" } as never)
    props.boards.teamBoard.actions.runAction("user_1", "lock")
    props.boards.teamBoard.actions.revokeStaff("user_1")
    props.boards.teacherAssignment.onSave()

    await Promise.resolve()

    expect(updateStaffPayrollModel).toHaveBeenCalledWith("user_1", "model_1")
    expect(openProfileModal).toHaveBeenCalled()
    expect(runAction).toHaveBeenCalledWith("user_1", "lock")
    expect(revokeStaff).toHaveBeenCalledWith("user_1")
    expect(saveTeacherPerformance).toHaveBeenCalledTimes(1)

    props.boards.teamBoard.permissions.onPermissionDenied()
    expect(setError).toHaveBeenCalledWith("Admins cannot manage Owner accounts.")
  })
})

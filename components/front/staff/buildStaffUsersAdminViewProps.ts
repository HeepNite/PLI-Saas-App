import type { StaffRole } from "@/lib/security/staff-role"
import type { StaffUsersAdminViewProps } from "./StaffUsersAdminView"

type BuildStaffUsersAdminViewPropsInput = {
  shell: StaffUsersAdminViewProps["shell"]
  boards: {
    profileView: StaffUsersAdminViewProps["boards"]["profileView"]
    accessCreate: {
      showStaffOps: boolean
      form: StaffUsersAdminViewProps["boards"]["accessCreate"]["form"]
      assignableRoles: StaffUsersAdminViewProps["boards"]["accessCreate"]["assignableRoles"]
      status: StaffUsersAdminViewProps["boards"]["accessCreate"]["status"]
      createStaff: StaffUsersAdminViewProps["boards"]["accessCreate"]["onSubmit"]
    }
    utilityPanels: StaffUsersAdminViewProps["boards"]["utilityPanels"]
    teamBoard: Omit<StaffUsersAdminViewProps["boards"]["teamBoard"], "actions" | "payrollModels" | "permissions"> & {
      currentUserId: string
      canManageTarget: StaffUsersAdminViewProps["boards"]["teamBoard"]["permissions"]["canManageTarget"]
      setError: (value: string) => void
      payrollModels: {
        options: StaffUsersAdminViewProps["boards"]["teamBoard"]["payrollModels"]["options"]
        loading: boolean
        error: string | null
        actionByUserId: StaffUsersAdminViewProps["boards"]["teamBoard"]["payrollModels"]["actionByUserId"]
        updateStaffPayrollModel: (
          userId: Parameters<StaffUsersAdminViewProps["boards"]["teamBoard"]["payrollModels"]["updateModel"]>[0],
          paymentModelId: Parameters<StaffUsersAdminViewProps["boards"]["teamBoard"]["payrollModels"]["updateModel"]>[1]
        ) => Promise<void>
      }
      openProfileModal: (row: Parameters<StaffUsersAdminViewProps["boards"]["teamBoard"]["actions"]["openProfile"]>[0]) => Promise<void>
      openDelayDetails: StaffUsersAdminViewProps["boards"]["teamBoard"]["actions"]["openDelayDetails"]
      runAction: (userId: string, action: string) => Promise<void>
      revokeStaff: (userId: string) => Promise<void>
    }
    teacherAssignment: Omit<StaffUsersAdminViewProps["boards"]["teacherAssignment"], "onSave"> & {
      saveTeacherPerformance: () => Promise<void>
    }
    schoolWorkspace: StaffUsersAdminViewProps["boards"]["schoolWorkspace"]
    payrollControl: StaffUsersAdminViewProps["boards"]["payrollControl"]
    studentsBoard: StaffUsersAdminViewProps["boards"]["studentsBoard"]
    reports: StaffUsersAdminViewProps["boards"]["reports"]
    approvals: StaffUsersAdminViewProps["boards"]["approvals"]
    teamCalendar: StaffUsersAdminViewProps["boards"]["teamCalendar"]
    performanceMetrics: StaffUsersAdminViewProps["boards"]["performanceMetrics"]
  }
  assistant: StaffUsersAdminViewProps["assistant"]
  modals: StaffUsersAdminViewProps["modals"]
  actions: {
    handleNavSelection: StaffUsersAdminViewProps["shell"]["handleNavSelection"]
    setPaymentHistoryStudentId: (value: string | null) => void
    setPaymentHistoryAnchor: (value: HTMLElement | null) => void
    setAttendanceHistoryStudentId: (value: string | null) => void
    setAttendanceHistoryAnchor: (value: HTMLElement | null) => void
    setAuditHistoryAnchor: (value: HTMLElement | null) => void
    setAuditHistoryStudentId: (value: string | null) => void
    setAuditHistoryStudentName: (value: string | null) => void
    markUserHasAuditEntries: (studentId: string) => void
    refreshPaymentsBoard: () => Promise<void>
  }
  formatters: StaffUsersAdminViewProps["formatters"]
  statusBanners: { currentRole: StaffRole }
}

export function buildStaffUsersAdminViewProps(input: BuildStaffUsersAdminViewPropsInput): StaffUsersAdminViewProps {
  const teamBoardActions: StaffUsersAdminViewProps["boards"]["teamBoard"]["actions"] = {
    openProfile: (row) => {
      void input.boards.teamBoard.openProfileModal(row)
    },
    openDelayDetails: input.boards.teamBoard.openDelayDetails,
    runAction: (userId, action) => {
      void input.boards.teamBoard.runAction(userId, action)
    },
    revokeStaff: (userId) => {
      void input.boards.teamBoard.revokeStaff(userId)
    },
  }

  return {
    shell: input.shell,
    boards: {
      profileView: input.boards.profileView,
      accessCreate: {
        showStaffOps: input.boards.accessCreate.showStaffOps,
        form: input.boards.accessCreate.form,
        assignableRoles: input.boards.accessCreate.assignableRoles,
        status: input.boards.accessCreate.status,
        onSubmit: input.boards.accessCreate.createStaff,
      },
      utilityPanels: input.boards.utilityPanels,
      teamBoard: {
        showStaffOps: input.boards.teamBoard.showStaffOps,
        filters: input.boards.teamBoard.filters,
        search: input.boards.teamBoard.search,
        data: input.boards.teamBoard.data,
        permissions: {
          canManageTarget: input.boards.teamBoard.canManageTarget,
          currentUserId: input.boards.teamBoard.currentUserId,
          onPermissionDenied: () => input.boards.teamBoard.setError("Admins cannot manage Owner accounts."),
        },
        payrollModels: {
          options: input.boards.teamBoard.payrollModels.options,
          loading: input.boards.teamBoard.payrollModels.loading,
          error: input.boards.teamBoard.payrollModels.error,
          actionByUserId: input.boards.teamBoard.payrollModels.actionByUserId,
          updateModel: (userId, paymentModelId) => {
            void input.boards.teamBoard.payrollModels.updateStaffPayrollModel(userId, paymentModelId)
          },
        },
        presence: input.boards.teamBoard.presence,
        actions: teamBoardActions,
      },
      teacherAssignment: {
        ...input.boards.teacherAssignment,
        onSave: () => {
          void input.boards.teacherAssignment.saveTeacherPerformance()
        },
      },
      schoolWorkspace: input.boards.schoolWorkspace,
      payrollControl: input.boards.payrollControl,
      studentsBoard: input.boards.studentsBoard,
      reports: input.boards.reports,
      approvals: input.boards.approvals,
      teamCalendar: input.boards.teamCalendar,
      performanceMetrics: input.boards.performanceMetrics,
    },
    assistant: input.assistant,
    modals: input.modals,
    actions: {
      onOpenAssistantConfig: () => input.actions.handleNavSelection("assistant"),
      onClosePaymentHistory: () => {
        input.actions.setPaymentHistoryStudentId(null)
        input.actions.setPaymentHistoryAnchor(null)
      },
      onCloseAttendanceHistory: () => {
        input.actions.setAttendanceHistoryStudentId(null)
        input.actions.setAttendanceHistoryAnchor(null)
      },
      onCloseAuditHistory: () => {
        input.actions.setAuditHistoryAnchor(null)
        input.actions.setAuditHistoryStudentId(null)
        input.actions.setAuditHistoryStudentName(null)
      },
      onOverrideSuccess: (studentId) => {
        input.actions.markUserHasAuditEntries(studentId)
        void input.actions.refreshPaymentsBoard()
      },
    },
    formatters: input.formatters,
    statusBanners: input.statusBanners,
  }
}

export type { BuildStaffUsersAdminViewPropsInput }

import React from "react"
import type { StaffRole } from "@/lib/security/staff-role"
import StaffPortalNavButton, { type StaffPortalNavItem } from "./StaffPortalNavButton"
import StaffAssistantRightRail from "./StaffAssistantRightRail"
import StaffProfileViewPanel from "./StaffProfileViewPanel"
import StaffProfileModal from "./StaffProfileModal"
import StaffApprovalsPanel from "./StaffApprovalsPanel"
import StaffTeamCalendarPanel from "./StaffTeamCalendarPanel"
import StaffPerformanceMetricsPanel from "./StaffPerformanceMetricsPanel"
import StaffReportsPanel from "./StaffReportsPanel"
import StaffStudentsBoardPanel from "./StaffStudentsBoardPanel"
import StaffTeamBoardPanel from "./StaffTeamBoardPanel"
import StaffTeacherAssignmentPanel from "./StaffTeacherAssignmentPanel"
import StaffPayrollControlPanel from "./StaffPayrollControlPanel"
import StaffAccessCreatePanel from "./StaffAccessCreatePanel"
import StaffSchoolWorkspacePanel from "./StaffSchoolWorkspacePanel"
import StaffAdminUtilityPanels from "./StaffAdminUtilityPanels"
import StaffAdminModalOverlays from "./StaffAdminModalOverlays"
import StaffAdminHistoryOverlays from "./StaffAdminHistoryOverlays"
import StaffAssistantRailContent from "./StaffAssistantRailContent"

export type StaffUsersAdminViewProps = {
  shell: {
    gridRef: React.RefObject<HTMLDivElement | null>
    leftRailRef: React.RefObject<HTMLDivElement | null>
    showInlineRightRail: boolean
    reserveAssistantColumn: boolean
    isAssistantLayoutSettling: boolean
    visibleNavItems: StaffPortalNavItem[]
    activeNav: string
    handleNavSelection: React.ComponentProps<typeof StaffPortalNavButton>["onSelect"]
  }
  boards: {
    profileView: React.ComponentProps<typeof StaffProfileViewPanel>
    accessCreate: React.ComponentProps<typeof StaffAccessCreatePanel>
    utilityPanels: React.ComponentProps<typeof StaffAdminUtilityPanels>
    teamBoard: React.ComponentProps<typeof StaffTeamBoardPanel>
    teacherAssignment: React.ComponentProps<typeof StaffTeacherAssignmentPanel>
    schoolWorkspace: React.ComponentProps<typeof StaffSchoolWorkspacePanel>
    payrollControl: React.ComponentProps<typeof StaffPayrollControlPanel>
    studentsBoard: React.ComponentProps<typeof StaffStudentsBoardPanel>
    reports: React.ComponentProps<typeof StaffReportsPanel>
    approvals: React.ComponentProps<typeof StaffApprovalsPanel>
    teamCalendar: React.ComponentProps<typeof StaffTeamCalendarPanel>
    performanceMetrics: React.ComponentProps<typeof StaffPerformanceMetricsPanel>
  }
  assistant: {
    rightRail: Omit<React.ComponentProps<typeof StaffAssistantRightRail>, "children">
    content: React.ComponentProps<typeof StaffAssistantRailContent>
  }
  modals: {
    adminModalOverlays: React.ComponentProps<typeof StaffAdminModalOverlays>
    profileModal: Omit<React.ComponentProps<typeof StaffProfileModal>, "assignableRoles">
    assignableRoles: React.ComponentProps<typeof StaffAccessCreatePanel>["assignableRoles"]
    adminHistoryOverlays: Omit<
      React.ComponentProps<typeof StaffAdminHistoryOverlays>,
      | "currentRole"
      | "onClosePaymentHistory"
      | "onCloseAttendanceHistory"
      | "onCloseAuditHistory"
      | "onOverrideSuccess"
      | "resolveHistoryDateIso"
    >
  }
  actions: {
    onOpenAssistantConfig: () => void
    onClosePaymentHistory: () => void
    onCloseAttendanceHistory: () => void
    onCloseAuditHistory: () => void
    onOverrideSuccess: (studentId: string) => void
  }
  formatters: {
    resolveHistoryDateIso: (referenceDate?: Date, timeZone?: string) => string
  }
  statusBanners: {
    currentRole: StaffRole
  }
}

export default function StaffUsersAdminView({
  shell,
  boards,
  assistant,
  modals,
  actions,
  formatters,
  statusBanners,
}: StaffUsersAdminViewProps) {
  return (
    <>
      <div
        ref={shell.gridRef}
        className={`relative grid gap-y-4 min-[1180px]:gap-x-2 min-[1180px]:items-start ${
          shell.reserveAssistantColumn
            ? "min-[1180px]:grid-cols-[86px_minmax(0,1fr)_330px] xl:grid-cols-[90px_minmax(0,1fr)_360px]"
            : "min-[1180px]:grid-cols-[86px_minmax(0,1fr)] xl:grid-cols-[90px_minmax(0,1fr)]"
        }`}
      >
        <aside className="hidden min-[1180px]:sticky min-[1180px]:top-3 min-[1180px]:z-40 min-[1180px]:block min-[1180px]:h-fit min-[1180px]:self-start">
          <div
            ref={shell.leftRailRef}
            className="relative rounded-2xl border border-black/10 bg-white/80 p-3 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#11131a]/90"
          >
            <div className="flex flex-col items-center gap-2" role="tablist" aria-orientation="vertical" aria-label="Staff portal sections">
              {shell.visibleNavItems.map((item) => (
                <StaffPortalNavButton
                  key={item.key}
                  item={item}
                  active={shell.activeNav === item.key}
                  layout="rail"
                  onSelect={shell.handleNavSelection}
                />
              ))}
            </div>
          </div>
        </aside>

        <section
          className={`min-w-0 transform-gpu space-y-4 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
            shell.isAssistantLayoutSettling
              ? "min-[1180px]:translate-y-[1px] min-[1180px]:scale-[0.997] min-[1180px]:opacity-[0.985]"
              : "min-[1180px]:translate-y-0 min-[1180px]:scale-100 min-[1180px]:opacity-100"
          }`}
        >
          <div className="min-[1180px]:hidden">
            <div className="rounded-xl border border-black/10 bg-white/80 p-1.5 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#11131a]/90 sm:p-2">
              <div
                className="overflow-hidden"
                role="tablist"
                aria-orientation="horizontal"
                aria-label="Staff portal sections"
              >
                <div className="flex flex-nowrap items-center gap-1 sm:gap-1.5">
                  {shell.visibleNavItems.map((item) => (
                    <StaffPortalNavButton
                      key={item.key}
                      item={item}
                      active={shell.activeNav === item.key}
                      layout="tabs"
                      onSelect={shell.handleNavSelection}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <StaffProfileViewPanel {...boards.profileView} />
          <StaffAccessCreatePanel {...boards.accessCreate} />
          <StaffAdminUtilityPanels {...boards.utilityPanels} />
          <StaffTeamBoardPanel {...boards.teamBoard} />
          <StaffTeacherAssignmentPanel {...boards.teacherAssignment} />
          <StaffSchoolWorkspacePanel {...boards.schoolWorkspace} />
          <StaffPayrollControlPanel {...boards.payrollControl} />
          <StaffStudentsBoardPanel {...boards.studentsBoard} />
          <StaffReportsPanel {...boards.reports} />
          <StaffApprovalsPanel {...boards.approvals} />
          <StaffTeamCalendarPanel {...boards.teamCalendar} />
          <StaffPerformanceMetricsPanel {...boards.performanceMetrics} />
        </section>

        <StaffAssistantRightRail {...assistant.rightRail}>
          <StaffAssistantRailContent
            {...assistant.content}
            onOpenAssistantConfig={actions.onOpenAssistantConfig}
          />
        </StaffAssistantRightRail>
      </div>

      <StaffAdminModalOverlays {...modals.adminModalOverlays} />
      <StaffProfileModal {...modals.profileModal} assignableRoles={modals.assignableRoles} />
      <StaffAdminHistoryOverlays
        {...modals.adminHistoryOverlays}
        currentRole={statusBanners.currentRole}
        onClosePaymentHistory={actions.onClosePaymentHistory}
        onCloseAttendanceHistory={actions.onCloseAttendanceHistory}
        onCloseAuditHistory={actions.onCloseAuditHistory}
        onOverrideSuccess={actions.onOverrideSuccess}
        resolveHistoryDateIso={formatters.resolveHistoryDateIso}
      />
    </>
  )
}

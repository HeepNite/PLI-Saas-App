import { HealthController } from "./health/health.controller"
import { QrDecisionController } from "./checkin/qr-decision.controller"
import { TodayClassesController } from "./checkin/today-classes.controller"
import { ConnectionTokenController } from "./terminal/connection-token.controller"

export class AppModule {}

export const appControllers = [
  HealthController,
  TodayClassesController,
  QrDecisionController,
  ConnectionTokenController,
]

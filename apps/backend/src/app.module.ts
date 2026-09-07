import { HealthController } from "./health/health.controller"
import { QrDecisionController } from "./checkin/qr-decision.controller"
import { TodayClassesController } from "./checkin/today-classes.controller"
import { ConnectionTokenController } from "./terminal/connection-token.controller"
import { NativeConnectionTokenController } from "./terminal/native-connection-token.controller"
import { NativePaymentJobsController } from "./terminal/native-payment-jobs.controller"
import { PaymentIntentsController } from "./terminal/payment-intents.controller"

export class AppModule {}

export const appControllers = [
  HealthController,
  TodayClassesController,
  QrDecisionController,
  ConnectionTokenController,
  NativeConnectionTokenController,
  NativePaymentJobsController,
  PaymentIntentsController,
]

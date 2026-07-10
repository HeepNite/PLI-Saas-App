import { HealthController } from "./health/health.controller"
import { TodayClassesController } from "./checkin/today-classes.controller"

export class AppModule {}

export const appControllers = [HealthController, TodayClassesController]

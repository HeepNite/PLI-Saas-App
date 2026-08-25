import { TodayClassesService } from "./today-classes.service"
import type { CheckinTodayClassesResponse } from "@/lib/nest-gateway/contracts/checkin-today-classes"

type TodayClassesServicePort = Pick<TodayClassesService, "getTodayClasses">

export class TodayClassesController {
  constructor(private readonly todayClassesService: TodayClassesServicePort = new TodayClassesService()) {}

  async getTodayClasses(): Promise<CheckinTodayClassesResponse> {
    return this.todayClassesService.getTodayClasses()
  }
}

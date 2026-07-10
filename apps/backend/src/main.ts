import { AppModule, appControllers } from "./app.module"
import { TodayClassesController } from "./checkin/today-classes.controller"
import { HealthController } from "./health/health.controller"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"

const NOT_FOUND_STATUS = 404
const OK_STATUS = 200
const UNAUTHORIZED_STATUS = 401

export type BackendRequestHandler = (request: Request) => Promise<Response>

type BackendControllers = {
  healthController?: Pick<HealthController, "getHealth">
  todayClassesController?: Pick<TodayClassesController, "getTodayClasses">
}

export const createBackendRequestHandler = (
  { healthController = new HealthController(), todayClassesController = new TodayClassesController() }: BackendControllers = {}
): BackendRequestHandler => {
  return async (request) => {
    const { pathname } = new URL(request.url)
    const expectedSharedSecret = process.env.NEST_GATEWAY_SHARED_SECRET?.trim()

    if (pathname.startsWith("/internal/")) {
      const requestSharedSecret = request.headers.get(INTERNAL_AUTH_HEADER)?.trim()

      if (!expectedSharedSecret || requestSharedSecret !== expectedSharedSecret) {
        return new Response(null, { status: UNAUTHORIZED_STATUS })
      }
    }

    if (request.method === "GET" && pathname === "/internal/health") {
      return Response.json(healthController.getHealth(), { status: OK_STATUS })
    }

    if (request.method === "GET" && pathname === "/internal/checkin/today-classes") {
      return Response.json(await todayClassesController.getTodayClasses(), { status: OK_STATUS })
    }

    return new Response(null, { status: NOT_FOUND_STATUS })
  }
}

export const bootstrapBackendApp = () => ({
  module: AppModule,
  controllers: appControllers,
  handleRequest: createBackendRequestHandler(),
})

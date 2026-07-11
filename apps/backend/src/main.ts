import { AppModule, appControllers } from "./app.module"
import { HealthController } from "./health/health.controller"

const NOT_FOUND_STATUS = 404
const OK_STATUS = 200

export type BackendRequestHandler = (request: Request) => Promise<Response>

export const createBackendRequestHandler = (
  controller: Pick<HealthController, "getHealth"> = new HealthController()
): BackendRequestHandler => {
  return async (request) => {
    const { pathname } = new URL(request.url)

    if (request.method === "GET" && pathname === "/internal/health") {
      return Response.json(controller.getHealth(), { status: OK_STATUS })
    }

    return new Response(null, { status: NOT_FOUND_STATUS })
  }
}

export const bootstrapBackendApp = () => ({
  module: AppModule,
  controllers: appControllers,
  handleRequest: createBackendRequestHandler(),
})

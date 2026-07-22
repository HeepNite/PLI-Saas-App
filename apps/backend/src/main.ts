import { AppModule, appControllers } from "./app.module"
import { QrDecisionController } from "./checkin/qr-decision.controller"
import { TodayClassesController } from "./checkin/today-classes.controller"
import { HealthController } from "./health/health.controller"
import { ConnectionTokenController } from "./terminal/connection-token.controller"
import { PaymentIntentsController } from "./terminal/payment-intents.controller"
import { INTERNAL_AUTH_HEADER } from "@/lib/nest-gateway/auth"
import type { CheckinQrDecisionGatewayRequest } from "@/lib/nest-gateway/contracts/checkin-qr-decision"
import { parseTerminalConnectionTokenGatewayRequest } from "@/lib/nest-gateway/contracts/terminal-precutover"
import { parseTerminalPaymentIntentGatewayRequest } from "@/lib/nest-gateway/contracts/terminal-payment-intents"

const NOT_FOUND_STATUS = 404
const OK_STATUS = 200
const BAD_REQUEST_STATUS = 400
const UNAUTHORIZED_STATUS = 401
const INTERNAL_SERVER_ERROR_STATUS = 500
const BAD_GATEWAY_STATUS = 502

const createTerminalPaymentIntentErrorResponse = (error: unknown) => {
  if (error instanceof Error && error.message === "Stripe payment intent missing client secret") {
    return Response.json({ error: "Terminal payment intent client secret missing" }, { status: BAD_GATEWAY_STATUS })
  }

  return Response.json({ error: "Unable to create terminal payment intent" }, { status: INTERNAL_SERVER_ERROR_STATUS })
}

export type BackendRequestHandler = (request: Request) => Promise<Response>

type BackendControllers = {
  connectionTokenController?: Pick<ConnectionTokenController, "post">
  healthController?: Pick<HealthController, "getHealth">
  paymentIntentsController?: Pick<PaymentIntentsController, "post">
  qrDecisionController?: Pick<QrDecisionController, "getQrDecision">
  todayClassesController?: Pick<TodayClassesController, "getTodayClasses">
}

export const createBackendRequestHandler = (
  {
    connectionTokenController = new ConnectionTokenController(),
    healthController = new HealthController(),
    paymentIntentsController = new PaymentIntentsController(),
    qrDecisionController = new QrDecisionController(),
    todayClassesController = new TodayClassesController(),
  }: BackendControllers = {}
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

    if (request.method === "POST" && pathname === "/internal/checkin/qr/decision") {
      let payload: CheckinQrDecisionGatewayRequest
      try {
        payload = (await request.json()) as CheckinQrDecisionGatewayRequest
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: BAD_REQUEST_STATUS })
      }

      return Response.json(await qrDecisionController.getQrDecision(payload), { status: OK_STATUS })
    }

    if (request.method === "POST" && pathname === "/internal/terminal/connection-token") {
      let payload: unknown
      try {
        payload = await request.json()
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: BAD_REQUEST_STATUS })
      }

      const connectionTokenRequest = parseTerminalConnectionTokenGatewayRequest(payload)
      if (!connectionTokenRequest) {
        return Response.json({ error: "Invalid terminal connection-token payload" }, { status: BAD_REQUEST_STATUS })
      }

      return Response.json(await connectionTokenController.post(connectionTokenRequest), { status: OK_STATUS })
    }

    if (request.method === "POST" && pathname === "/internal/terminal/payment-intents") {
      let payload: unknown
      try {
        payload = await request.json()
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: BAD_REQUEST_STATUS })
      }

      const paymentIntentRequest = parseTerminalPaymentIntentGatewayRequest(payload)
      if (!paymentIntentRequest) {
        return Response.json({ error: "Invalid terminal payment-intent payload" }, { status: BAD_REQUEST_STATUS })
      }

      try {
        return Response.json(await paymentIntentsController.post(paymentIntentRequest), { status: OK_STATUS })
      } catch (error) {
        return createTerminalPaymentIntentErrorResponse(error)
      }
    }

    return new Response(null, { status: NOT_FOUND_STATUS })
  }
}

export const bootstrapBackendApp = () => ({
  module: AppModule,
  controllers: appControllers,
  handleRequest: createBackendRequestHandler(),
})

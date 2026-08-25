export type InternalHealthResponse = {
  ok: true
  service: "nest"
}

export class HealthController {
  getHealth(): InternalHealthResponse {
    return { ok: true, service: "nest" }
  }
}

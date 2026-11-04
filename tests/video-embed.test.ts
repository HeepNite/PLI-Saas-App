import { describe, expect, it } from "vitest"
import { isEmbedVideoUrl, toAutoplayEmbedUrl, toEmbedVideoUrl } from "@/lib/video-embed"

const PARAMS = { youtube: "autoplay=1", vimeo: "autoplay=1&muted=1" }

describe("toEmbedVideoUrl", () => {
  it("converts YouTube watch, short and Vimeo links to embed URLs", () => {
    expect(toEmbedVideoUrl("https://www.youtube.com/watch?v=abc123XYZ_-&t=10")).toBe(
      "https://www.youtube.com/embed/abc123XYZ_-"
    )
    expect(toEmbedVideoUrl("https://youtu.be/abc123XYZ_-?si=x")).toBe("https://www.youtube.com/embed/abc123XYZ_-")
    expect(toEmbedVideoUrl("https://vimeo.com/123456789?share=copy")).toBe("https://player.vimeo.com/video/123456789")
  })

  it("keeps existing embed URLs and plain video files unchanged", () => {
    expect(toEmbedVideoUrl("https://www.youtube.com/embed/abc123XYZ_-")).toBe("https://www.youtube.com/embed/abc123XYZ_-")
    expect(toEmbedVideoUrl("https://cdn.example.com/hero.mp4")).toBe("https://cdn.example.com/hero.mp4")
    expect(toEmbedVideoUrl("  ")).toBe("")
  })

  it("accepts schemeless and protocol-relative links like before", () => {
    expect(toEmbedVideoUrl("youtube.com/watch?v=abc123XYZ_-")).toBe("https://www.youtube.com/embed/abc123XYZ_-")
    expect(toEmbedVideoUrl("youtu.be/abc123XYZ_-")).toBe("https://www.youtube.com/embed/abc123XYZ_-")
    expect(toEmbedVideoUrl("vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789")
    expect(isEmbedVideoUrl("//www.youtube.com/embed/abc123XYZ_-")).toBe(true)
    expect(isEmbedVideoUrl("player.vimeo.com/video/123")).toBe(true)
  })

  it("does not treat lookalike hosts as YouTube or Vimeo", () => {
    expect(toEmbedVideoUrl("https://evil.com/youtube.com/watch?v=abc123XYZ_-")).toBe(
      "https://evil.com/youtube.com/watch?v=abc123XYZ_-"
    )
    expect(toEmbedVideoUrl("https://notyoutu.be/abc123XYZ_-")).toBe("https://notyoutu.be/abc123XYZ_-")
    expect(toEmbedVideoUrl("https://evil.com/?vimeo.com/123")).toBe("https://evil.com/?vimeo.com/123")
  })
})

describe("isEmbedVideoUrl", () => {
  it("accepts only real YouTube and Vimeo player hosts", () => {
    expect(isEmbedVideoUrl("https://www.youtube.com/embed/abc123XYZ_-")).toBe(true)
    expect(isEmbedVideoUrl("https://player.vimeo.com/video/123456789")).toBe(true)
    expect(isEmbedVideoUrl("https://evil.com/youtube.com/embed/abc")).toBe(false)
    expect(isEmbedVideoUrl("https://evil.com/?x=player.vimeo.com/video/1")).toBe(false)
    expect(isEmbedVideoUrl("javascript:alert(1)//youtube.com/embed/x")).toBe(false)
    expect(isEmbedVideoUrl("not a url")).toBe(false)
  })
})

describe("toAutoplayEmbedUrl", () => {
  it("appends the provider-specific params with the right separator", () => {
    expect(toAutoplayEmbedUrl("https://www.youtube.com/embed/abc", PARAMS)).toBe(
      "https://www.youtube.com/embed/abc?autoplay=1"
    )
    expect(toAutoplayEmbedUrl("https://www.youtube.com/embed/abc?start=5", PARAMS)).toBe(
      "https://www.youtube.com/embed/abc?start=5&autoplay=1"
    )
    expect(toAutoplayEmbedUrl("https://player.vimeo.com/video/1", PARAMS)).toBe(
      "https://player.vimeo.com/video/1?autoplay=1&muted=1"
    )
  })

  it("leaves non-embed URLs untouched", () => {
    expect(toAutoplayEmbedUrl("https://evil.com/youtube.com/embed/abc", PARAMS)).toBe(
      "https://evil.com/youtube.com/embed/abc"
    )
  })
})

import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | Palladium Latin Art",
  description:
    "How Palladium Latin Art LLC collects, uses, and protects your information, including SMS text messaging consent.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh w-full bg-[#13141d] px-5 py-12 text-white/90 sm:py-16">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-white/10 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Privacy Policy — Palladium Latin Art LLC
          </h1>
          <p className="text-sm text-white/50">Last updated: July 24, 2026</p>
        </header>

        <p className="leading-relaxed text-white/80">
          Palladium Latin Art LLC (&ldquo;Palladium Latin Art,&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy. This Privacy Policy
          explains what information we collect, how we use it, and your choices.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">Information We Collect</h2>
          <p className="leading-relaxed text-white/80">
            Contact and account information you provide, such as your name, email address, and
            mobile phone number. Account and usage information related to your use of the PLI staff
            application.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">How We Use Your Information</h2>
          <p className="leading-relaxed text-white/80">
            We use your information to operate and secure the PLI staff application, authenticate
            users, verify and enroll trusted devices, and communicate with you about your account.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">SMS / Text Messaging</h2>
          <p className="leading-relaxed text-white/80">
            When you provide your mobile phone number and enroll a device in the PLI staff
            application, you consent to receive transactional SMS text messages from Palladium Latin
            Art, including one-time verification codes and account-security notifications.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-6 leading-relaxed text-white/80">
            <li>
              Message frequency varies and is limited to device-enrollment and account-security
              events.
            </li>
            <li>Message and data rates may apply.</li>
            <li>You can opt out at any time by replying STOP. Reply HELP for help.</li>
            <li>
              We do not sell, rent, or share your mobile phone number, SMS opt-in, or consent with
              any third parties or affiliates for their marketing or promotional purposes. Mobile
              information will not be shared with third parties for marketing or promotional
              purposes.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">How We Share Information</h2>
          <p className="leading-relaxed text-white/80">
            We share information only with service providers who help us operate the application (for
            example, our authentication provider and our SMS delivery provider), and only to the
            extent necessary to provide the service. We do not sell your personal information. As
            stated above, mobile phone numbers and SMS consent are never shared for third-party
            marketing.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">Data Security</h2>
          <p className="leading-relaxed text-white/80">
            We use reasonable administrative, technical, and physical safeguards to protect your
            information.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">Your Choices</h2>
          <p className="leading-relaxed text-white/80">
            You may opt out of SMS messages at any time by replying STOP. You may contact us to
            access, correct, or delete your information.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white sm:text-xl">Contact Us</h2>
          <p className="leading-relaxed text-white/80">
            If you have questions about this Privacy Policy, contact us at{" "}
            <a
              href="mailto:marianobarr@palladiumlatin.art"
              className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              marianobarr@palladiumlatin.art
            </a>
            .
          </p>
        </section>

        <footer className="border-t border-white/10 pt-6 text-sm text-white/50">
          <Link
            href="/sms-terms"
            className="underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            SMS Terms &amp; Conditions
          </Link>
        </footer>
      </article>
    </main>
  )
}

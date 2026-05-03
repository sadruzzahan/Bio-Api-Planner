import { SignUp } from "@clerk/react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/onboarding`}
      />

      {/* Pre-signup legal notice. Acceptance is recorded server-side after
          first sign-in via the consent modal, but operators must see the
          links here so they understand what they will be agreeing to. */}
      <div
        className="mt-6 max-w-md text-center"
        data-testid="signup-legal-notice"
      >
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          By creating an account you will be asked to accept our{" "}
          <Link
            href="/legal/terms"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            data-testid="signup-link-terms"
          >
            Terms of Service
          </Link>
          ,{" "}
          <Link
            href="/legal/privacy"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            data-testid="signup-link-privacy"
          >
            Privacy Policy
          </Link>
          , and{" "}
          <Link
            href="/legal/disclaimer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            data-testid="signup-link-disclaimer"
          >
            Medical Disclaimer
          </Link>
          . BioOS is not a medical device and does not provide medical
          advice — consult a licensed clinician for health decisions.
        </p>
      </div>
    </div>
  );
}

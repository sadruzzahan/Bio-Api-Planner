import { COMPANY } from "@/lib/legal";

/**
 * Terms-of-Service body. Reused by the public /legal/terms page and the
 * post-signin consent modal so the operator sees identical wording in both
 * places.
 */
export function TermsContent() {
  return (
    <>
      <p>
        These Terms of Service ("Terms") govern your access to and use of the
        BioOS platform, including the BioOS web app, APIs, and any related
        services (collectively, the "Service") provided by {COMPANY.name}
        ("{COMPANY.shortName}", "we", "us"). By creating an account or using the
        Service you agree to these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and legally able to enter into a
        binding contract to use the Service. The Service is not directed at
        children under 13. If we learn we have collected personal data from a
        child under 13 we will delete it.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</li>
        <li>You will notify us immediately at {COMPANY.contact} of any unauthorised access.</li>
        <li>One person, one account. Sharing accounts is prohibited.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse-engineer, scrape, or attempt to extract source code or model weights from the Service.</li>
        <li>Upload data you do not have the right to share, or any unlawful, harmful, or infringing content.</li>
        <li>Use the Service to provide medical care to third parties.</li>
        <li>Interfere with the integrity or performance of the Service or attempt to bypass rate limits or security controls.</li>
      </ul>

      <h2>4. Subscriptions, billing &amp; cancellation</h2>
      <p>
        Paid plans renew automatically at the end of each billing period at the
        then-current price. You may cancel at any time from your profile;
        cancellation takes effect at the end of the current billing period and
        you retain access through that period. Fees are non-refundable except
        where required by law.
      </p>

      <h2>5. User content &amp; license</h2>
      <p>
        You retain ownership of all content you submit (including biometric
        readings, supplement logs, and chat messages — collectively "User
        Content"). You grant {COMPANY.shortName} a worldwide, non-exclusive,
        royalty-free licence to host, store, process, transmit, and display
        User Content solely as required to operate, improve, and secure the
        Service for you. We do not sell your User Content.
      </p>

      <h2>6. AI-generated output</h2>
      <p>
        The Service includes an AI assistant. AI output may be inaccurate,
        incomplete, or out of date. You are solely responsible for evaluating
        the accuracy and suitability of any AI output for your situation. AI
        output is informational only and is not medical, diagnostic, or
        treatment advice (see the Medical Disclaimer).
      </p>

      <h2>7. Third-party integrations</h2>
      <p>
        Connecting third-party services (e.g. wearables, glucose monitors)
        causes your data to flow between those services and BioOS subject to
        their respective terms and privacy policies. You are responsible for
        reviewing those terms.
      </p>

      <h2>8. Termination</h2>
      <p>
        We may suspend or terminate your access if you breach these Terms or
        if we are required to do so by law. You may terminate your account at
        any time from your profile, which initiates the deletion process
        described in our Privacy Policy.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        EXCEPT WHERE PROHIBITED BY LAW, THE SERVICE IS PROVIDED "AS IS" AND
        "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL
        BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL
        {" "}{COMPANY.shortName}'S AGGREGATE LIABILITY ARISING OUT OF OR
        RELATING TO THE SERVICE EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID
        US IN THE 12 MONTHS PRECEDING THE EVENT GIVING RISE TO THE LIABILITY
        OR (B) ONE HUNDRED U.S. DOLLARS (USD $100). WE WILL NOT BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You will defend and indemnify {COMPANY.shortName} from any claims
        arising out of your User Content, your use of the Service in breach of
        these Terms, or your violation of applicable law.
      </p>

      <h2>12. Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA,
        without regard to its conflict-of-laws principles. Any dispute will be
        resolved by binding arbitration in Wilmington, Delaware, except either
        party may bring an individual action in small-claims court. You waive
        any right to participate in a class action.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        announced in-app at least 14 days before they take effect, and we will
        ask you to re-accept the new version before continued use.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms? Email us at{" "}
        <a href={`mailto:${COMPANY.contact}`} className="text-primary">
          {COMPANY.contact}
        </a>
        .
      </p>
    </>
  );
}

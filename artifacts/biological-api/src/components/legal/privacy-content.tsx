import { COMPANY } from "@/lib/legal";

/**
 * Privacy-policy body. Reused by the public /legal/privacy page and the
 * post-signin consent modal.
 */
export function PrivacyContent() {
  return (
    <>
      <p>
        This Privacy Policy explains what personal data {COMPANY.name}
        ("{COMPANY.shortName}", "we") collects when you use the BioOS Service,
        why we collect it, how we use it, and the rights you have over it. We
        designed BioOS to minimise the personal data we hold and to give you
        direct control over export and deletion.
      </p>

      <h2>1. Data we collect</h2>
      <h3>a. Account data</h3>
      <ul>
        <li>Identifier data: name, email address, profile image (via Clerk).</li>
        <li>Authentication metadata: sign-in events, device, IP address, session timestamps.</li>
      </ul>
      <h3>b. Health &amp; biometric data</h3>
      <ul>
        <li>Biometric readings (HRV, resting HR, recovery, SpO₂, temperature, etc.).</li>
        <li>Sleep sessions, glucose readings, activity sessions.</li>
        <li>Self-reported meals, supplements, interventions, and chat messages.</li>
      </ul>
      <h3>c. Integration data</h3>
      <ul>
        <li>OAuth tokens and metadata from connected wearables and CGMs (encrypted at rest).</li>
      </ul>
      <h3>d. Operational data</h3>
      <ul>
        <li>Audit-log entries describing security-relevant actions on your account.</li>
        <li>Server logs (request paths, error traces — without request bodies).</li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul>
        <li>To provide, secure, and improve the Service.</li>
        <li>To compute biological-state classifications and personalised interventions for you.</li>
        <li>To prevent fraud, abuse, and to comply with legal obligations.</li>
        <li>We do not sell your personal data. We do not use your User Content to train third-party AI models.</li>
      </ul>

      <h2>3. Legal bases (GDPR / UK GDPR)</h2>
      <ul>
        <li><strong>Contract</strong> — to provide the Service you have signed up for.</li>
        <li><strong>Legitimate interests</strong> — to secure the Service and prevent abuse.</li>
        <li><strong>Consent</strong> — for non-essential cookies and optional product analytics. You can withdraw at any time.</li>
        <li><strong>Legal obligation</strong> — to respond to lawful requests.</li>
      </ul>

      <h2>4. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li><strong>Sub-processors</strong> that operate the Service on our behalf, under written data-processing agreements: cloud hosting (Replit), authentication (Clerk), AI model providers (Anthropic), and email (when configured).</li>
        <li><strong>Third-party integrations</strong> you explicitly connect.</li>
        <li><strong>Authorities</strong> when required by valid legal process.</li>
      </ul>

      <h2>5. Security</h2>
      <ul>
        <li>Data in transit is protected with TLS.</li>
        <li>Email addresses, OAuth tokens, and integration credentials are encrypted at rest with AES-256-GCM under a server-side key.</li>
        <li>Authentication is delegated to Clerk and supports MFA.</li>
        <li>All security-relevant writes are recorded in an append-only audit log scoped to your account.</li>
      </ul>

      <h2>6. Retention</h2>
      <ul>
        <li>While your account is active we retain your data so the Service can function.</li>
        <li>When you request deletion we soft-delete your account immediately and purge all rows after a 30-day grace window during which you can cancel by contacting {COMPANY.contact}.</li>
        <li>Audit-log entries are retained for up to 2 years for security purposes, then purged.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li><strong>Access &amp; export</strong> a complete JSON archive of your data from <em>Profile → Privacy → Export my data</em>.</li>
        <li><strong>Rectify</strong> profile and biometric data directly in-app.</li>
        <li><strong>Erase</strong> your account from <em>Profile → Privacy → Delete my account</em>.</li>
        <li><strong>Withdraw consent</strong> for cookies / analytics from the cookie banner or <em>Profile → Privacy</em>.</li>
        <li><strong>Object</strong> or <strong>restrict</strong> processing by contacting {COMPANY.contact}.</li>
        <li><strong>Lodge a complaint</strong> with your local data-protection authority.</li>
      </ul>

      <h2>8. International transfers</h2>
      <p>
        BioOS is operated from the United States. If you access the Service
        from outside the U.S. your data will be transferred to and processed
        in the U.S. under appropriate safeguards (Standard Contractual Clauses
        where applicable).
      </p>

      <h2>9. Children</h2>
      <p>
        BioOS is not directed at children under 13 and we do not knowingly
        collect personal data from them. If you believe we have, contact us
        and we will delete it.
      </p>

      <h2>10. California &amp; other U.S. states</h2>
      <p>
        California, Colorado, Virginia, Connecticut, and similar state
        privacy-law residents have the rights described in §7. We do not sell
        or share personal information for cross-context behavioural
        advertising.
      </p>

      <h2>11. Changes</h2>
      <p>
        Material changes to this Policy will be announced in-app at least 14
        days before they take effect.
      </p>

      <h2>12. Contact</h2>
      <p>
        Privacy enquiries:{" "}
        <a href={`mailto:${COMPANY.contact}`} className="text-primary">
          {COMPANY.contact}
        </a>
        . Postal: {COMPANY.address}.
      </p>
    </>
  );
}

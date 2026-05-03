import { COMPANY } from "@/lib/legal";

/**
 * Medical-disclaimer body. Reused by the public /legal/disclaimer page and
 * the post-signin consent modal. Wording is deliberately direct so it cannot
 * be misread as offering medical advice.
 */
export function DisclaimerContent() {
  return (
    <>
      <p>
        BioOS is an informational and self-tracking tool. It is{" "}
        <strong>not</strong> a medical device, not a substitute for
        professional medical advice, and not intended to diagnose, treat,
        cure, or prevent any disease or condition.
      </p>

      <h2>1. Not medical advice</h2>
      <p>
        The biometric summaries, biological-state classifications,
        interventions, supplement suggestions, and AI assistant output that
        BioOS surfaces are educational. They are generated from sensor and
        self-reported data and may be incomplete, delayed, or incorrect. They
        do not establish a clinician-patient relationship and they are not a
        prescription.
      </p>

      <h2>2. Always consult a qualified clinician</h2>
      <ul>
        <li>Before starting, stopping, or changing any supplement, medication, dietary regimen, or training programme.</li>
        <li>If you are pregnant, nursing, immunocompromised, or have a known medical condition.</li>
        <li>If you experience any unexpected symptoms, including chest pain, shortness of breath, fainting, severe hypoglycaemia, or thoughts of self-harm.</li>
      </ul>

      <h2>3. Emergencies</h2>
      <p>
        BioOS does <strong>not</strong> monitor you in real time and cannot
        contact emergency services on your behalf. If you are experiencing a
        medical emergency, call your local emergency number (e.g. 911 in the
        U.S., 112 in the EU) immediately.
      </p>

      <h2>4. Sensor accuracy</h2>
      <p>
        Wearable and CGM sensors have known accuracy limitations and may
        report values that diverge from clinical-grade measurements,
        especially during motion, low perfusion, or sensor warm-up. Do not
        make treatment decisions on the basis of a single reading.
      </p>

      <h2>5. AI output</h2>
      <p>
        The BioOS assistant can hallucinate, miss context, or be wrong. Treat
        every AI suggestion as a hypothesis to discuss with a qualified
        professional, not as a directive.
      </p>

      <h2>6. Your responsibility</h2>
      <p>
        You assume all responsibility and risk for any decisions you make
        based on information surfaced by the Service. To the maximum extent
        permitted by law, {COMPANY.name} disclaims all liability for any
        adverse outcome related to your use of the Service.
      </p>

      <h2>7. Contact</h2>
      <p>
        Questions about this disclaimer? Email{" "}
        <a href={`mailto:${COMPANY.contact}`} className="text-primary">
          {COMPANY.contact}
        </a>
        .
      </p>
    </>
  );
}

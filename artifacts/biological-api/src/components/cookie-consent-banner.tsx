import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useRecordConsent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LEGAL_VERSIONS } from "@/lib/legal";

const STORAGE_KEY = "bioos.cookie-consent.v1";

interface StoredConsent {
  version: string;
  acceptedAt: string;
  categories: { essential: true; analytics: boolean; marketing: boolean };
}

function readStored(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== LEGAL_VERSIONS.cookies) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: StoredConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* localStorage may be disabled — non-fatal, banner will reappear next visit */
  }
}

/**
 * Cookie + analytics consent banner. Persists the user's choice to
 * localStorage immediately so the banner doesn't re-flash, and also POSTs the
 * consent record to the server when the user is signed in.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const { isSignedIn } = useUser();
  const recordConsent = useRecordConsent();

  useEffect(() => {
    setVisible(readStored() === null);
  }, []);

  // Sync any pre-signin cookie consent (recorded to localStorage on the
  // landing page before the user authenticated) to the server on the
  // first authenticated session. Uses a session-scoped flag so we do not
  // re-POST on every component mount.
  useEffect(() => {
    if (!isSignedIn) return;
    const stored = readStored();
    if (!stored) return;
    const syncedKey = `${STORAGE_KEY}.synced.${stored.version}`;
    if (sessionStorage.getItem(syncedKey)) return;
    try {
      sessionStorage.setItem(syncedKey, "1");
    } catch {
      /* sessionStorage may be disabled — non-fatal */
    }
    recordConsent.mutate({
      data: {
        document: "cookies",
        version: stored.version,
        accepted:
          stored.categories.analytics || stored.categories.marketing
            ? true
            : true, // essential always true → record acceptance either way
        categories: stored.categories,
      },
    });
  }, [isSignedIn, recordConsent]);

  const persist = (
    accepted: boolean,
    categories: StoredConsent["categories"],
  ) => {
    writeStored({
      version: LEGAL_VERSIONS.cookies,
      acceptedAt: new Date().toISOString(),
      categories,
    });
    setVisible(false);
    if (isSignedIn) {
      // Fire-and-forget — server-side persistence is best-effort. The
      // localStorage record is the source of truth for whether to render
      // the banner.
      recordConsent.mutate({
        data: {
          document: "cookies",
          version: LEGAL_VERSIONS.cookies,
          accepted,
          categories,
        },
      });
    }
  };

  const acceptAll = () =>
    persist(true, { essential: true, analytics: true, marketing: true });
  const rejectAll = () =>
    persist(false, { essential: true, analytics: false, marketing: false });
  const saveCustom = () =>
    persist(analytics || marketing, {
      essential: true,
      analytics,
      marketing,
    });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 border border-primary/30 bg-card/95 backdrop-blur rounded-lg shadow-xl"
          role="dialog"
          aria-label="Cookie consent"
          data-testid="cookie-banner"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-mono font-bold uppercase tracking-wider text-xs">
                  Cookies &amp; analytics
                </h3>
                <p className="font-sans text-xs text-muted-foreground mt-1 leading-relaxed">
                  Essential cookies keep you signed in and the app secure.
                  Optional analytics help us improve BioOS. See our{" "}
                  <Link
                    href="/legal/privacy"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={rejectAll}
                aria-label="Reject all and close"
                className="text-muted-foreground hover:text-foreground"
                data-testid="cookie-banner-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showCustomize && (
              <div className="space-y-2 border-t border-border pt-3">
                <Row label="Strictly necessary" desc="Required for sign-in & security" disabled />
                <Row
                  label="Product analytics"
                  desc="Aggregated usage to improve BioOS"
                  checked={analytics}
                  onChange={setAnalytics}
                  testId="cookie-toggle-analytics"
                />
                <Row
                  label="Marketing"
                  desc="Personalised tips & launch announcements"
                  checked={marketing}
                  onChange={setMarketing}
                  testId="cookie-toggle-marketing"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              {!showCustomize && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomize(true)}
                  className="font-mono text-xs uppercase tracking-wider"
                  data-testid="cookie-customize"
                >
                  Customize
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={rejectAll}
                className="font-mono text-xs uppercase tracking-wider"
                data-testid="cookie-reject"
              >
                Reject non-essential
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={showCustomize ? saveCustom : acceptAll}
                className="font-mono text-xs uppercase tracking-wider"
                data-testid="cookie-accept"
              >
                {showCustomize ? "Save preferences" : "Accept all"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface RowProps {
  label: string;
  desc: string;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  testId?: string;
}

function Row({ label, desc, checked, onChange, disabled, testId }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <p className="font-mono text-xs uppercase tracking-wider">{label}</p>
        <p className="font-sans text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch
        checked={disabled ? true : !!checked}
        onCheckedChange={onChange}
        disabled={disabled}
        data-testid={testId}
      />
    </div>
  );
}

import { Link } from "wouter";
import { Activity, ArrowLeft } from "lucide-react";
import { EFFECTIVE_DATE, LEGAL_VERSIONS, type LegalDocument } from "@/lib/legal";

interface LegalPageShellProps {
  title: string;
  document: LegalDocument;
  children: React.ReactNode;
}

/**
 * Public-facing shell for the legal pages. Designed to be readable both as a
 * landing-style document and as content embedded in the consent modal.
 */
export function LegalPageShell({ title, document, children }: LegalPageShellProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase text-sm"
          >
            <Activity className="w-4 h-4" />
            <span>BioOS</span>
          </Link>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            data-testid="legal-back"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-3xl">
        <div className="mb-8 border-b border-border pb-6">
          <h1
            className="text-3xl font-mono font-bold uppercase tracking-wider mb-2"
            data-testid={`legal-title-${document}`}
          >
            {title}
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            Version {LEGAL_VERSIONS[document]} · Effective {EFFECTIVE_DATE}
          </p>
        </div>

        <article className="prose prose-invert max-w-none font-sans leading-relaxed [&_h2]:font-mono [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-primary [&_h3]:font-mono [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-sm [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:text-sm [&_p]:text-foreground/90 [&_li]:text-sm [&_li]:text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </article>

        <footer className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-primary">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-primary">Privacy</Link>
          <Link href="/legal/disclaimer" className="hover:text-primary">Medical Disclaimer</Link>
        </footer>
      </main>
    </div>
  );
}

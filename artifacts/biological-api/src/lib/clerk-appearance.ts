import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${basePath}/logo.svg`
        : `${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(174 100% 42%)",
    colorForeground: "hsl(180 5% 92%)",
    colorMutedForeground: "hsl(180 4% 60%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(220 13% 9%)",
    colorInput: "hsl(220 13% 12%)",
    colorInputForeground: "hsl(180 5% 92%)",
    colorNeutral: "hsl(220 13% 22%)",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-card border border-border rounded-lg w-[440px] max-w-full overflow-hidden shadow-2xl shadow-primary/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none !p-8",
    footer:
      "!shadow-none !border-0 !bg-transparent !rounded-none !px-8 !py-4 border-t border-border",
    headerTitle: "font-mono uppercase tracking-wider text-foreground text-xl",
    headerSubtitle: "font-mono text-sm text-muted-foreground",
    socialButtonsBlockButton:
      "border border-border hover:bg-accent hover:border-primary/40 transition-colors",
    socialButtonsBlockButtonText: "font-mono text-sm text-foreground",
    formFieldLabel: "font-mono text-xs uppercase tracking-wider text-muted-foreground",
    formFieldInput:
      "bg-input border border-border font-mono text-foreground focus:border-primary focus:ring-primary/20",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 font-mono uppercase tracking-wider transition-colors",
    footerAction: "font-mono",
    footerActionText: "text-muted-foreground font-mono text-xs",
    footerActionLink:
      "text-primary hover:text-primary/80 font-mono text-xs uppercase tracking-wider",
    dividerText: "text-muted-foreground font-mono text-xs uppercase",
    dividerLine: "bg-border",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-primary font-mono text-xs",
    alert: "border border-destructive/40 bg-destructive/10",
    alertText: "font-mono text-sm text-destructive",
    otpCodeFieldInput: "bg-input border-border text-foreground font-mono",
    formFieldRow: "space-y-2",
    main: "space-y-6",
    logoBox: "justify-start",
    logoImage: "h-7 w-auto",
  },
};

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Authorize Operator",
      subtitle: "Sign in to access your biological mission control",
    },
  },
  signUp: {
    start: {
      title: "Initialize Operator",
      subtitle: "Create an account to begin biological optimization",
    },
  },
};

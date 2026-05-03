interface ProviderLogoProps {
  provider: string;
  className?: string;
}

const BRAND: Record<string, { bg: string; fg: string; mark: string }> = {
  whoop:  { bg: "#000000", fg: "#FFFFFF", mark: "W" },
  oura:   { bg: "#0F172A", fg: "#F1F5F9", mark: "O" },
  fitbit: { bg: "#00B0B9", fg: "#FFFFFF", mark: "F" },
  dexcom: { bg: "#0067B1", fg: "#FFFFFF", mark: "D" },
};

export function ProviderLogo({ provider, className }: ProviderLogoProps) {
  const brand = BRAND[provider] ?? { bg: "#475569", fg: "#FFFFFF", mark: provider.charAt(0).toUpperCase() };
  return (
    <div
      className={`flex items-center justify-center font-bold font-mono ${className ?? "w-10 h-10 text-base rounded-md"}`}
      style={{ background: brand.bg, color: brand.fg }}
      aria-label={`${provider} logo`}
      data-testid={`logo-${provider}`}
    >
      {brand.mark}
    </div>
  );
}

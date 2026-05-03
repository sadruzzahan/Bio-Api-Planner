import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  ClerkProvider,
  Show,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-appearance";

import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Biometrics from "@/pages/biometrics";
import Sleep from "@/pages/sleep";
import Chat from "@/pages/chat";
import Integrations from "@/pages/integrations";
import Supplements from "@/pages/supplements";
import Profile from "@/pages/profile";
import Onboarding from "@/pages/onboarding";
import Glucose from "@/pages/glucose";
import Activity from "@/pages/activity";
import Interventions from "@/pages/interventions";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY env var");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function OnboardingGate({
  children,
  allowWithoutOnboarding = false,
}: {
  children: React.ReactNode;
  allowWithoutOnboarding?: boolean;
}) {
  const { data: user, isLoading, isError } = useGetCurrentUser();
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          Initializing telemetry…
        </div>
      </div>
    );
  }
  // If the user record can't be fetched, render anyway — individual pages
  // surface their own error states. Avoids a redirect loop on transient API failures.
  if (isError || !user) return <>{children}</>;
  if (!user.onboardedAt && !allowWithoutOnboarding) {
    return <Redirect to="/onboarding" />;
  }
  return <>{children}</>;
}

function Protected({
  children,
  allowWithoutOnboarding = false,
}: {
  children: React.ReactNode;
  allowWithoutOnboarding?: boolean;
}) {
  return (
    <>
      <Show when="signed-in">
        <OnboardingGate allowWithoutOnboarding={allowWithoutOnboarding}>
          {children}
        </OnboardingGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding">{() => <Protected allowWithoutOnboarding><Onboarding /></Protected>}</Route>
      <Route path="/dashboard">{() => <Protected><Dashboard /></Protected>}</Route>
      <Route path="/biometrics">{() => <Protected><Biometrics /></Protected>}</Route>
      <Route path="/sleep">{() => <Protected><Sleep /></Protected>}</Route>
      <Route path="/glucose">{() => <Protected><Glucose /></Protected>}</Route>
      <Route path="/activity">{() => <Protected><Activity /></Protected>}</Route>
      <Route path="/interventions">{() => <Protected><Interventions /></Protected>}</Route>
      <Route path="/chat">{() => <Protected><Chat /></Protected>}</Route>
      <Route path="/integrations">{() => <Protected><Integrations /></Protected>}</Route>
      <Route path="/supplements">{() => <Protected><Supplements /></Protected>}</Route>
      <Route path="/profile">{() => <Protected><Profile /></Protected>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${basePath}/onboarding`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ThemeProvider defaultTheme="dark" storageKey="bio-theme">
          <TooltipProvider>
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
            <Toaster theme="dark" />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

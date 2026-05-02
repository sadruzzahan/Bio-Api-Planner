import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/biometrics" component={Biometrics} />
      <Route path="/sleep" component={Sleep} />
      <Route path="/glucose" component={Glucose} />
      <Route path="/activity" component={Activity} />
      <Route path="/interventions" component={Interventions} />
      <Route path="/chat" component={Chat} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/supplements" component={Supplements} />
      <Route path="/profile" component={Profile} />
      <Route path="/onboarding" component={Onboarding} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="bio-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster theme="dark" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
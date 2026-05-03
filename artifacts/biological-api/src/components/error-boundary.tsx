import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BioOS ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden px-6" data-testid="error-boundary-screen">
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,100,100,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,100,100,0.15)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="relative z-10 text-center max-w-md">
            <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase mb-12 justify-center">
              <Activity className="w-5 h-5" />
              <span>BioOS</span>
            </div>
            <div className="w-20 h-20 bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive mx-auto mb-8">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="font-mono text-4xl font-bold text-destructive/30 mb-4">RUNTIME ERROR</div>
            <h1 className="text-2xl font-mono font-bold uppercase tracking-tight mb-3">System Fault Detected</h1>
            <p className="text-muted-foreground font-mono text-sm mb-4">
              A rendering error occurred in this module. The error has been logged.
            </p>
            {this.state.error && (
              <pre className="text-xs font-mono text-destructive/70 bg-destructive/5 border border-destructive/20 rounded p-3 mb-8 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} className="font-mono uppercase tracking-wider" data-testid="btn-retry-error">
                <RefreshCw className="w-4 h-4 mr-2" /> Retry Module
              </Button>
              <Button variant="outline" onClick={() => { window.location.href = "/dashboard"; }} className="font-mono uppercase tracking-wider">
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

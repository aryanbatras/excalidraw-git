"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="grid h-full place-items-center bg-white px-6 text-center">
            <div>
              <p className="text-[14px] font-medium text-[#1b1b1f]">Something went wrong</p>
              <p className="mt-1 text-[13px] text-[#868686]">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-4 rounded-xl bg-[#1b1b1f] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#1b1b1f]/90"
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

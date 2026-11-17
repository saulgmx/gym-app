import { Component, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches render errors outside the router (plan §6.11); React already logs them to the console.
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}

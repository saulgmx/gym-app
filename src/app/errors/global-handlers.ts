import { GENERIC_ERROR_MESSAGE } from './messages';
import { useNoticeStore } from './notice-store';

/**
 * Catches what no error boundary sees: uncaught errors in handlers and unhandled promise
 * rejections (ADR-0010, AC-29). Returns a function that removes the listeners.
 */
export function installGlobalErrorHandlers(): () => void {
  const report = (error: unknown) => {
    // No preventDefault(): the browser keeps its own log as well.
    console.error('Unexpected error', error);
    useNoticeStore.getState().showNotice({ message: GENERIC_ERROR_MESSAGE });
  };
  const onError = (event: ErrorEvent) => {
    // Without an error object it is not the app's code, which is same-origin and only throws
    // Error: Safari's own scripts (its share sheet), extensions or other origins (spec 007 §8,
    // decision 19). Logged so the inspector still shows it.
    if (event.error === null || event.error === undefined) {
      console.warn('Ignored error from outside the app', event.message);
      return;
    }
    report(event.error);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    report(event.reason);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

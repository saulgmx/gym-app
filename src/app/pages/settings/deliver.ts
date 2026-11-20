// Hands the backup to the share sheet (iCloud, Files, mail) or downloads it (spec 007 plan §6.7,
// §8 decision 15). navigator, URL and the timer are injected so tests can replace them.

export type DeliveryOutcome = 'shared' | 'cancelled' | 'downloaded';

export interface DeliveryEnv {
  navigator: Partial<Pick<Navigator, 'canShare' | 'share'>>;
  document: Document;
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  setTimeout: (fn: () => void, ms: number) => void;
}

/** Revoking at once can cut the download short in Safari; a minute costs only memory (15 (d)). */
const REVOKE_AFTER_MS = 60_000;

const browserEnv = (): DeliveryEnv => ({
  navigator,
  document,
  url: URL,
  setTimeout: (fn, ms) => {
    window.setTimeout(fn, ms);
  },
});

function download(file: File, env: DeliveryEnv): DeliveryOutcome {
  const href = env.url.createObjectURL(file);
  const link = env.document.createElement('a');
  link.href = href;
  link.download = file.name;
  // (c) some browsers ignore a click on a link outside the document.
  env.document.body.append(link);
  link.click();
  link.remove();
  env.setTimeout(() => {
    env.url.revokeObjectURL(href);
  }, REVOKE_AFTER_MS);
  return 'downloaded';
}

export async function deliverFile(
  file: File,
  env: DeliveryEnv = browserEnv(),
): Promise<DeliveryOutcome> {
  const { canShare, share } = env.navigator;
  // (a) only when the browser says it can share this file; share without canShare may not take files.
  if (canShare && share && canShare.call(env.navigator, { files: [file] })) {
    try {
      await share.call(env.navigator, { files: [file], title: file.name });
      return 'shared';
    } catch (error) {
      // AC-6: the user closed the sheet. Anything else (NotAllowedError outside the gesture)
      // falls back to the download.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return download(file, env);
}

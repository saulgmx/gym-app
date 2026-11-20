import { err, ok, type Result } from '@/shared/kernel';
import type {
  DataError,
  Envelope,
  InvalidModuleDataDetails,
  PortInfo,
  UnsupportedVersionDetails,
} from './types';

// Steps 3 and 4 of the review (RN-DAT-02, contract v1.3 §6 "Detalle de la revisión").

/** The backup format this version of the app writes and reads. */
export const SCHEMA_VERSION = 1;

function unsupported(details: UnsupportedVersionDetails): Result<never, DataError> {
  const what = details.module ?? 'schemaVersion';
  return err({
    code: 'data/unsupported-version',
    message: `${what} ${String(details.version)} is newer than ${String(details.supported)} (RN-DAT-02)`,
    details,
  });
}

/** Step 3: nothing newer than this app. Unregistered or missing modules are step 4's job. */
export function checkVersions(envelope: Envelope, ports: PortInfo[]): Result<void, DataError> {
  if (envelope.schemaVersion > SCHEMA_VERSION) {
    return unsupported({
      module: null,
      version: envelope.schemaVersion,
      supported: SCHEMA_VERSION,
    });
  }
  for (const port of ports) {
    if (!Object.hasOwn(envelope.modules, port.name)) continue;
    const { version } = envelope.modules[port.name] as { version: number };
    if (version > port.version) {
      return unsupported({ module: port.name, version, supported: port.version });
    }
  }
  return ok(undefined);
}

/** Step 4: the file holds exactly the registered modules, in any order. */
export function checkModules(envelope: Envelope, ports: PortInfo[]): Result<void, DataError> {
  const inFile = Object.keys(envelope.modules);
  const registered = ports.map((p) => p.name);
  const missing = registered.filter((name) => !inFile.includes(name));
  const unexpected = inFile.filter((name) => !registered.includes(name));
  if (missing.length === 0 && unexpected.length === 0) return ok(undefined);

  const details: InvalidModuleDataDetails = {
    module: null,
    cause: 'data/module-mismatch',
    details: { missing, unexpected },
  };
  return err({
    code: 'data/invalid-module-data',
    message: `Modules do not match: missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}] (RN-DAT-02)`,
    details,
  });
}

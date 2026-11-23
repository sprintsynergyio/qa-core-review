// Loaded with `node --import` by the exit code test: makes writing report.json fail with an
// error the CLI does not expect, so the "internal error" path can be checked end to end.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const writeFileSync = fs.writeFileSync;
fs.writeFileSync = (file, ...rest) => {
  if (String(file).endsWith('report.json')) throw new TypeError('boom from the crash preload');
  return writeFileSync(file, ...rest);
};
syncBuiltinESMExports();

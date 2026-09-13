import electron from 'electron';
import { run } from './media-tools/process.mjs';

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
await run(electron, ['.'], { env: environment });

import ELK from 'elkjs/lib/elk.bundled.js';
// Node unit tests use the same ELK algorithm without requiring a browser Worker.
export const engine = new ELK();

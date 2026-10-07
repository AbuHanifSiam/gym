import { handle } from '../server/app.js';

// All /api/* requests are rewritten here (see vercel.json). Single Vercel function for the whole API (keeps us under the Hobby plan's function limit).
export default handle;

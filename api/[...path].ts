import { handle } from '../server/app.js';

// Single Vercel function for the whole API (keeps us under the Hobby plan's function limit).
export default handle;

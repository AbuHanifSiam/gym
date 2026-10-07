import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('deployment config', () => {
  it('CSP allows exactly the inline theme script in index.html', () => {
    // Browsers hash the bytes Vercel serves (LF line endings, see .gitattributes).
    const html = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
    const inline = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    const hash = `sha256-${createHash('sha256').update(inline).digest('base64')}`;
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const csp = vercel.headers
      .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
      .find((h: { key: string }) => h.key === 'Content-Security-Policy').value as string;
    expect(csp).toContain(`'${hash}'`);
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

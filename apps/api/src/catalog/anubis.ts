import { createHash } from 'node:crypto';

export type AnubisChallengeDoc = {
  rules: { algorithm: string; difficulty: number };
  challenge: {
    id: string;
    randomData: string;
    difficulty?: number;
  };
};

export function readJsonScript<T = unknown>(
  html: string,
  id: string,
): T | null {
  const re = new RegExp(
    `id="${id}"[^>]*>\\s*([\\s\\S]*?)\\s*</script>`,
    'i',
  );
  const match = html.match(re);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

export function extractAnubisChallenge(
  html: string,
): AnubisChallengeDoc | null {
  const doc = readJsonScript<AnubisChallengeDoc>(html, 'anubis_challenge');
  if (!doc?.challenge?.id || !doc.challenge.randomData) return null;
  if (!doc.rules?.difficulty && doc.challenge.difficulty == null) return null;
  return doc;
}

export function isAnubisChallengeHtml(html: string): boolean {
  return (
    html.includes('anubis_challenge') ||
    html.includes('techaro.lol') ||
    html.includes('Проверяем, что вы не бот') ||
    html.includes('не бот')
  );
}

export function solveAnubisPow(
  randomData: string,
  difficulty: number,
): { hash: string; nonce: number; elapsedMs: number } {
  const prefix = '0'.repeat(Math.max(0, difficulty));
  const t0 = Date.now();
  let nonce = 0;
  let hash = '';
  for (;;) {
    hash = createHash('sha256')
      .update(`${randomData}${nonce}`)
      .digest('hex');
    if (hash.startsWith(prefix)) break;
    nonce += 1;
  }
  return { hash, nonce, elapsedMs: Date.now() - t0 };
}

export function buildPassChallengeUrl(
  pageUrl: string,
  basePrefix: string,
  challenge: AnubisChallengeDoc,
  solution: { hash: string; nonce: number; elapsedMs: number },
): string {
  const passUrl = new URL(
    `${basePrefix || ''}/.within.website/x/cmd/anubis/api/pass-challenge`,
    pageUrl,
  );
  passUrl.searchParams.set('id', challenge.challenge.id);
  passUrl.searchParams.set('response', solution.hash);
  passUrl.searchParams.set('nonce', String(solution.nonce));
  passUrl.searchParams.set('redir', pageUrl);
  passUrl.searchParams.set('elapsedTime', String(solution.elapsedMs));
  return passUrl.toString();
}

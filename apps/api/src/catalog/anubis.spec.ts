import {
  buildPassChallengeUrl,
  extractAnubisChallenge,
  solveAnubisPow,
} from './anubis';

describe('anubis', () => {
  it('solves difficulty-2 PoW', () => {
    const randomData =
      '783593b2cd3ad462bafd7b2cdd41cb0846bab3219aafa2fe104fcd271a4e3cb7';
    const { hash, nonce } = solveAnubisPow(randomData, 2);
    expect(hash.startsWith('00')).toBe(true);
    expect(nonce).toBeGreaterThanOrEqual(0);
  });

  it('extracts challenge JSON from HTML', () => {
    const html = `<script id="anubis_challenge" type="application/json">{"rules":{"algorithm":"fast","difficulty":2},"challenge":{"id":"abc","randomData":"deadbeef","difficulty":2}}</script>`;
    const doc = extractAnubisChallenge(html);
    expect(doc?.challenge.id).toBe('abc');
    expect(doc?.rules.difficulty).toBe(2);
  });

  it('builds pass-challenge URL', () => {
    const url = buildPassChallengeUrl(
      'https://rezka-ua.tv/films/x.html',
      '',
      {
        rules: { algorithm: 'fast', difficulty: 2 },
        challenge: { id: 'abc', randomData: 'ff' },
      },
      { hash: '00aa', nonce: 12, elapsedMs: 3 },
    );
    expect(url).toContain('/.within.website/x/cmd/anubis/api/pass-challenge');
    expect(url).toContain('id=abc');
    expect(url).toContain('nonce=12');
    expect(url).toContain('response=00aa');
  });
});

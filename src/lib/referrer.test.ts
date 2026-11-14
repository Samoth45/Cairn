import { describe, expect, it } from 'vitest';
import { isLoopbackHost, otmReferrerPolicy } from './referrer';

describe('referrer des tuiles OpenTopoMap', () => {
  it('reconnaît les hôtes locaux refusés par OpenTopoMap', () => {
    for (const h of ['localhost', 'LOCALHOST', 'app.localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]']) {
      expect(isLoopbackHost(h), h).toBe(true);
    }
  });

  it('garde le referrer en ligne et sur le réseau local (acceptés par OpenTopoMap)', () => {
    for (const h of ['cairn.vercel.app', 'cairn-git-develop-thomas.vercel.app', '192.168.1.20', '10.0.0.5', '172.27.0.4']) {
      expect(isLoopbackHost(h), h).toBe(false);
      expect(otmReferrerPolicy(h), h).toBeUndefined();
    }
  });

  it('supprime le referrer en local', () => {
    expect(otmReferrerPolicy('localhost')).toBe('no-referrer');
    expect(otmReferrerPolicy('127.0.0.1')).toBe('no-referrer');
  });
});

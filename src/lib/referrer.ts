/** Noms d'hôte de boucle locale (machine de développement). */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h.endsWith('.localhost') || h === '::1' || /^127(\.\d{1,3}){3}$/.test(h);
}

/**
 * Politique de referrer pour les tuiles OpenTopoMap.
 * OpenTopoMap refuse les referrers « génériques » (localhost, 127.0.0.1) : il renvoie alors
 * des tuiles barrées de « Generic referrer detected ». En local (dev Docker sur 5173, prod
 * locale sur 8080), on n'envoie donc pas de referrer ; en ligne (Vercel), on garde le
 * comportement par défaut du navigateur, qui identifie honnêtement le site (vérifié :
 * referrer Vercel et adresses du réseau local acceptés).
 */
export function otmReferrerPolicy(hostname: string): ReferrerPolicy | undefined {
  return isLoopbackHost(hostname) ? 'no-referrer' : undefined;
}

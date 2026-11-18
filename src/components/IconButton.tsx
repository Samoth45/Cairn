import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Bouton icône discret (ancien .icon-btn) : 28 px, 32 px sur mobile (cible au doigt).
 *  Toujours donner un `aria-label` ; l'icône Lucide est passée en enfant. */
export function IconButton({ className, ...props }: Omit<ComponentProps<typeof Button>, 'variant' | 'size'>) {
  return <Button type="button" variant="ghost" size="icon-sm" className={cn('max-md:size-8', className)} {...props} />;
}

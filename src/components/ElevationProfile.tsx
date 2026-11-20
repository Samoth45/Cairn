import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { ProfilePoint } from '../lib/stats';
import { nearestProfileIndex } from '../lib/stats';
import { niceStep, ticks } from '../lib/ticks';
import { formatKm, formatMeters, formatNumber, formatSlope } from '../lib/format';
import { eleAt, SLOPE_CLASSES, slopeAt, slopeClassIndex, slopeRuns } from '../lib/slope';
import { setHoverPoint } from '../hooks/useHoverPoint';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from '@/lib/utils';

const M = { top: 12, right: 14, bottom: 22, left: 48 };

interface Props {
  name: string;
  color: string;
  profile: ProfilePoint[];
  /** Message affiché à la place du graphique (altitudes en cours de récupération…). */
  placeholder?: string;
  onClose: () => void;
}

/** Profil altimétrique (altitude en fonction de la distance), en SVG. */
export function ElevationProfile({ name, color, profile, placeholder, onClose }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Point survolé, mémorisé avec son profil : un autre profil → aucun survol.
  const [hover, setHover] = useState<{ profile: ProfilePoint[]; idx: number } | null>(null);
  const hoverIdx = hover && hover.profile === profile ? hover.idx : null;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Le marqueur de la carte disparaît quand le profil change ou se ferme.
  useEffect(() => () => setHoverPoint(null), [profile]);

  const points = useMemo(() => profile.filter((p) => p.ele !== null) as Array<ProfilePoint & { ele: number }>, [profile]);

  const chart = useMemo(() => {
    if (points.length < 2 || size.w < 50 || size.h < 40) return null;
    const totalD = points[points.length - 1].d;
    let minE = Infinity;
    let maxE = -Infinity;
    for (const p of points) {
      if (p.ele < minE) minE = p.ele;
      if (p.ele > maxE) maxE = p.ele;
    }
    const innerW = size.w - M.left - M.right;
    const innerH = size.h - M.top - M.bottom;
    // Marge verticale pour ne pas écraser les petits dénivelés.
    const pad = Math.max(20, (maxE - minE) * 0.08);
    const eStep = niceStep(maxE - minE + 2 * pad, Math.max(2, Math.floor(innerH / 32)));
    const y0 = Math.floor((minE - pad) / eStep) * eStep;
    const y1 = Math.ceil((maxE + pad) / eStep) * eStep;
    const dStep = niceStep(totalD, Math.max(2, Math.floor(innerW / 70)));

    const x = (d: number) => M.left + (totalD > 0 ? (d / totalD) * innerW : 0);
    const y = (e: number) => M.top + innerH - ((e - y0) / (y1 - y0)) * innerH;

    // Un point par pixel environ suffit au tracé.
    const stride = Math.max(1, Math.floor(points.length / (innerW * 2)));
    let line = '';
    for (let i = 0; i < points.length; i += stride) {
      line += `${i === 0 ? 'M' : 'L'}${x(points[i].d).toFixed(1)},${y(points[i].ele).toFixed(1)}`;
    }
    const last = points[points.length - 1];
    line += `L${x(last.d).toFixed(1)},${y(last.ele).toFixed(1)}`;

    // Remplissage coloré par classe de pente : un chemin par classe (tronçons d'environ 2 px).
    const base = (M.top + innerH).toFixed(1);
    const slopePaths: string[] = SLOPE_CLASSES.map(() => '');
    const runStep = Math.max(10, (totalD / innerW) * 2);
    for (const run of slopeRuns(points, runStep)) {
      const sub = Math.max(1, Math.ceil(((run.d1 - run.d0) / totalD) * innerW)); // un sommet par pixel
      let p = `M${x(run.d0).toFixed(1)},${base}`;
      for (let k = 0; k <= sub; k++) {
        const d = run.d0 + ((run.d1 - run.d0) * k) / sub;
        p += `L${x(d).toFixed(1)},${y(eleAt(points, d)).toFixed(1)}`;
      }
      slopePaths[run.classIndex] += `${p}L${x(run.d1).toFixed(1)},${base}Z`;
    }

    const summit = points.reduce((a, b) => (b.ele > a.ele ? b : a));
    return { x, y, line, slopePaths, totalD, innerW, innerH, eTicks: ticks(y0, y1, eStep), dTicks: ticks(0, totalD, dStep), dStep, summit };
  }, [points, size]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    const d = Math.min(Math.max(px / chart.innerW, 0), 1) * chart.totalD;
    const idx = nearestProfileIndex(points, d);
    setHover({ profile, idx });
    setHoverPoint({ lat: points[idx].lat, lon: points[idx].lon, d: points[idx].d });
  };
  const onLeave = () => {
    setHover(null);
    setHoverPoint(null);
  };

  const hovered = hoverIdx !== null && chart ? points[hoverIdx] : null;
  const hoveredSlope = hovered ? slopeAt(points, hovered.d) : null;

  return (
    <section className="flex h-47.5 shrink-0 flex-col border-t bg-card max-md:h-37.5" aria-label="Profil altimétrique">
      <header className="flex min-h-7.5 items-center gap-2 pt-1 pr-2 pl-3.5 text-sm">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
        {/* Sur mobile, le nom et la légende laissent la place à la lecture du survol. */}
        <span className={cn('min-w-0 flex-1 truncate font-semibold', hovered && 'max-md:hidden')}>{name}</span>
        {chart && !placeholder && (
          <span
            className={cn('flex items-center gap-1.5 text-2xs whitespace-nowrap text-muted-foreground max-md:gap-1', hovered && 'max-md:hidden')}
            title="Pente (en %, calculée sur 100 m)"
          >
            {SLOPE_CLASSES.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1">
                <i className="inline-block size-2.5 rounded-xs opacity-75" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
            <span>%</span>
          </span>
        )}
        {hovered && (
          <span className={cn('whitespace-nowrap tabular-nums max-md:text-sm', hovered && 'max-md:flex-1')}>
            {formatKm(hovered.d)} · <strong>{formatMeters(hovered.ele)}</strong> ·{' '}
            <strong
              className="border-0 border-b-3 border-solid pb-px"
              style={{ borderColor: SLOPE_CLASSES[slopeClassIndex(hoveredSlope ?? 0)].color }}
              title="Pente sur 100 m"
            >
              {formatSlope(hoveredSlope)}
            </strong>
          </span>
        )}
        <IconButton onClick={onClose} aria-label="Masquer le profil" title="Masquer le profil">
          <X />
        </IconButton>
      </header>
      <div className="relative min-h-0 flex-1" ref={boxRef}>
        {placeholder || !chart ? (
          <p className="m-0 flex h-full items-center justify-center text-sm text-muted-foreground">{placeholder ?? (size.w ? 'Pas d’altitude pour ce tracé' : '')}</p>
        ) : (
          <svg className="block cursor-crosshair touch-none" width={size.w} height={size.h} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={onLeave} role="img">
            {chart.slopePaths.map((d, i) => d && <path key={i} d={d} fill={SLOPE_CLASSES[i].color} fillOpacity={0.55} />)}
            {chart.eTicks.map((e) => (
              <g key={`e${e}`}>
                <line className="stroke-border" strokeWidth={1} x1={M.left} x2={M.left + chart.innerW} y1={chart.y(e)} y2={chart.y(e)} />
                <text className="fill-muted-foreground text-2xs tabular-nums" x={M.left - 6} y={chart.y(e)} textAnchor="end" dominantBaseline="middle">
                  {formatNumber(e)}
                </text>
              </g>
            ))}
            {chart.dTicks.map((d) => (
              <text key={`d${d}`} className="fill-muted-foreground text-2xs tabular-nums" x={chart.x(d)} y={M.top + chart.innerH + 15} textAnchor="middle">
                {formatNumber(d / 1000, chart.dStep < 1000 ? 1 : 0)}
                {d === 0 ? ' km' : ''}
              </text>
            ))}
            <path d={chart.line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            <g transform={`translate(${chart.x(chart.summit.d)},${chart.y(chart.summit.ele)})`}>
              <path d="M0,-9 L5,-1 L-5,-1 Z" className="fill-foreground stroke-card" strokeWidth={1.5} />
            </g>
            {hovered && (
              <g>
                <line className="stroke-foreground" strokeWidth={1} strokeDasharray="3 3" x1={chart.x(hovered.d)} x2={chart.x(hovered.d)} y1={M.top} y2={M.top + chart.innerH} />
                <circle cx={chart.x(hovered.d)} cy={chart.y(hovered.ele)} r={4.5} fill="#fff" stroke={color} strokeWidth={2.5} />
              </g>
            )}
          </svg>
        )}
      </div>
    </section>
  );
}

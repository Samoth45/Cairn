import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { ProfilePoint } from '../lib/stats';
import { nearestProfileIndex } from '../lib/stats';
import { niceStep, ticks } from '../lib/ticks';
import { formatKm, formatMeters, formatNumber } from '../lib/format';
import { setHoverPoint } from '../hooks/useHoverPoint';

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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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
  useEffect(() => {
    setHoverIdx(null);
    return () => setHoverPoint(null);
  }, [profile]);

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
    const area = `${line}L${x(last.d).toFixed(1)},${M.top + innerH}L${M.left},${M.top + innerH}Z`;

    const summit = points.reduce((a, b) => (b.ele > a.ele ? b : a));
    return { x, y, line, area, totalD, innerW, innerH, eTicks: ticks(y0, y1, eStep), dTicks: ticks(0, totalD, dStep), dStep, summit };
  }, [points, size]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    const d = Math.min(Math.max(px / chart.innerW, 0), 1) * chart.totalD;
    const idx = nearestProfileIndex(points, d);
    setHoverIdx(idx);
    setHoverPoint({ lat: points[idx].lat, lon: points[idx].lon });
  };
  const onLeave = () => {
    setHoverIdx(null);
    setHoverPoint(null);
  };

  const hovered = hoverIdx !== null && chart ? points[hoverIdx] : null;
  const gradientId = 'profile-fill';

  return (
    <section className="profile" aria-label="Profil altimétrique">
      <header className="profile-header">
        <span className="profile-dot" style={{ background: color }} />
        <span className="profile-name">{name}</span>
        {hovered && (
          <span className="profile-readout">
            {formatKm(hovered.d)} · <strong>{formatMeters(hovered.ele)}</strong>
          </span>
        )}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Masquer le profil" title="Masquer le profil">
          ✕
        </button>
      </header>
      <div className="profile-chart" ref={boxRef}>
        {placeholder || !chart ? (
          <p className="profile-placeholder">{placeholder ?? (size.w ? 'Pas d’altitude pour ce tracé' : '')}</p>
        ) : (
          <svg width={size.w} height={size.h} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={onLeave} role="img">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.45" />
                <stop offset="100%" stopColor={color} stopOpacity="0.08" />
              </linearGradient>
            </defs>
            {chart.eTicks.map((e) => (
              <g key={`e${e}`}>
                <line className="grid" x1={M.left} x2={M.left + chart.innerW} y1={chart.y(e)} y2={chart.y(e)} />
                <text className="axis" x={M.left - 6} y={chart.y(e)} textAnchor="end" dominantBaseline="middle">
                  {formatNumber(e)}
                </text>
              </g>
            ))}
            {chart.dTicks.map((d) => (
              <text key={`d${d}`} className="axis" x={chart.x(d)} y={M.top + chart.innerH + 15} textAnchor="middle">
                {formatNumber(d / 1000, chart.dStep < 1000 ? 1 : 0)}
                {d === 0 ? ' km' : ''}
              </text>
            ))}
            <path d={chart.area} fill={`url(#${gradientId})`} />
            <path d={chart.line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            <g transform={`translate(${chart.x(chart.summit.d)},${chart.y(chart.summit.ele)})`}>
              <path d="M0,-9 L5,-1 L-5,-1 Z" className="summit-mark" />
            </g>
            {hovered && (
              <g>
                <line className="cursor" x1={chart.x(hovered.d)} x2={chart.x(hovered.d)} y1={M.top} y2={M.top + chart.innerH} />
                <circle cx={chart.x(hovered.d)} cy={chart.y(hovered.ele)} r={4.5} fill="#fff" stroke={color} strokeWidth={2.5} />
              </g>
            )}
          </svg>
        )}
      </div>
    </section>
  );
}

import type { Track } from '../types';

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** Génère un fichier GPX 1.1 : un <trk> avec un <trkseg> par segment, altitudes incluses. */
export function buildGpx(track: Pick<Track, 'name' | 'segments' | 'elevationSource'>, now = new Date()): string {
  const name = escapeXml(track.name);
  const desc =
    track.elevationSource === 'dem'
      ? '\n    <desc>Altitudes issues du modèle numérique de terrain (Open-Meteo), ajoutées par Cairn</desc>'
      : '';
  const segs = track.segments
    .map((seg) => {
      const pts = seg
        .map(([lat, lon, ele]) => {
          const e = ele === null ? '' : `<ele>${Math.round(ele * 10) / 10}</ele>`;
          return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${e}</trkpt>`;
        })
        .join('\n');
      return `    <trkseg>\n${pts}\n    </trkseg>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cairn" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${now.toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>${desc}
${segs}
  </trk>
</gpx>
`;
}

/** Nom de fichier sûr sur tous les systèmes, à partir du nom du tracé. */
export function gpxFileName(name: string): string {
  const clean = name
    // eslint-disable-next-line no-control-regex -- caractères de contrôle interdits dans un nom de fichier
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, '');
  return `${clean || 'trace'}.gpx`;
}

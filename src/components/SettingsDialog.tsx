import { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_DIN, type DinSpeeds } from '../types';

interface Props {
  din: DinSpeeds;
  onSave: (din: DinSpeeds) => void;
  onClose: () => void;
}

const FIELDS: Array<{ key: keyof DinSpeeds; label: string; unit: string; step: number }> = [
  { key: 'flatKmh', label: 'Vitesse à plat', unit: 'km/h', step: 0.1 },
  { key: 'ascentMh', label: 'Vitesse en montée', unit: 'm/h', step: 10 },
  { key: 'descentMh', label: 'Vitesse en descente', unit: 'm/h', step: 10 },
];

export function SettingsDialog({ din, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Record<keyof DinSpeeds, string>>(() => toDraft(din));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const num = (s: string) => Number(s.replace(',', '.'));
  const parsed: DinSpeeds = { flatKmh: num(draft.flatKmh), ascentMh: num(draft.ascentMh), descentMh: num(draft.descentMh) };
  const valid = FIELDS.every((f) => Number.isFinite(parsed[f.key]) && parsed[f.key] > 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave(parsed);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Paramètres">
        <h2>Paramètres</h2>
        <fieldset>
          <legend>Durée de marche (méthode DIN 33466)</legend>
          {FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                min={f.step}
                step={f.step}
                value={draft[f.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
              <span className="unit">{f.unit}</span>
            </label>
          ))}
          <p className="hint">
            Temps total = le plus grand des temps horizontal et vertical + la moitié du plus petit.
          </p>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setDraft(toDraft(DEFAULT_DIN))}>
            Valeurs par défaut
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn primary" disabled={!valid}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

function toDraft(din: DinSpeeds): Record<keyof DinSpeeds, string> {
  return { flatKmh: String(din.flatKmh), ascentMh: String(din.ascentMh), descentMh: String(din.descentMh) };
}

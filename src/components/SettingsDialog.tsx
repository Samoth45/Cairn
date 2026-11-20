import { useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  DEFAULT_DIN,
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_SETTINGS,
  type DinSpeeds,
  type ScoreWeights,
  type Settings,
  type Theme,
  type WeatherModel,
} from '../types';
import { MODEL_LABELS } from '../services/weather';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { PENALTY_ICONS, PENALTY_LABELS } from '../lib/score';
import { THEME_LABELS } from '../lib/theme';

interface Props {
  din: DinSpeeds;
  weatherModel: WeatherModel;
  scoreWeights: ScoreWeights;
  theme: Theme;
  onSave: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const FIELDS: Array<{ key: keyof DinSpeeds; label: string; unit: string; step: number }> = [
  { key: 'flatKmh', label: 'Vitesse à plat', unit: 'km/h', step: 0.1 },
  { key: 'ascentMh', label: 'Vitesse en montée', unit: 'm/h', step: 10 },
  { key: 'descentMh', label: 'Vitesse en descente', unit: 'm/h', step: 10 },
];

/**
 * Fenêtre Paramètres (Dialog de Radix). Montée seulement quand elle est ouverte (App) : les
 * brouillons repartent des réglages à chaque ouverture. Les changements ne s'appliquent qu'à
 * « Enregistrer » ; Échap, clic hors de la fenêtre et « Annuler » ferment sans rien changer.
 * Radix rend le focus au bouton ⚙ à la fermeture.
 */
export function SettingsDialog({ din, weatherModel, scoreWeights, theme, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Record<keyof DinSpeeds, string>>(() => toDraft(din));
  const [model, setModel] = useState<WeatherModel>(weatherModel);
  const [themeDraft, setThemeDraft] = useState<Theme>(theme);
  const [weightsDraft, setWeightsDraft] = useState<Record<keyof ScoreWeights, string>>(() => toWeightsDraft(scoreWeights));
  const id = useId();
  // Bouton qui a ouvert la fenêtre (⚙) : Radix ne rend le focus qu'à un DialogTrigger, que
  // nous n'avons pas (fenêtre montée par App) ; on le rend nous-mêmes à la fermeture.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  const num = (s: string) => Number(s.replace(',', '.'));
  const parsed: DinSpeeds = { flatKmh: num(draft.flatKmh), ascentMh: num(draft.ascentMh), descentMh: num(draft.descentMh) };
  const parsedWeights = Object.fromEntries(WEIGHT_FIELDS.map((k) => [k, num(weightsDraft[k])])) as unknown as ScoreWeights;
  const valid =
    FIELDS.every((f) => Number.isFinite(parsed[f.key]) && parsed[f.key] > 0) &&
    WEIGHT_FIELDS.every((k) => weightsDraft[k].trim() !== '' && parsedWeights[k] >= 0 && parsedWeights[k] <= 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ din: parsed, weatherModel: model, scoreWeights: parsedWeights, theme: themeDraft });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        // Focus sur la fenêtre, pas sur le 1er champ (sinon le clavier s'ouvre sur mobile).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          opener?.focus();
        }}
        className="gap-3 p-5 outline-none sm:max-w-md"
      >
        <DialogTitle className="text-lg font-semibold">Paramètres</DialogTitle>
        {/* « contents » : les blocs du formulaire restent les cases de la grille de la fenêtre. */}
        <form className="contents" onSubmit={submit} aria-label="Paramètres">
          <Section legend="Durée de marche (méthode DIN 33466)">
            {FIELDS.map((f) => (
              <NumberField
                key={f.key}
                id={`${id}-${f.key}`}
                label={f.label}
                unit={f.unit}
                inputMode="decimal"
                min={f.step}
                step={f.step}
                value={draft[f.key]}
                onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              />
            ))}
            <Hint>Temps total = le plus grand des temps horizontal et vertical + la moitié du plus petit.</Hint>
          </Section>

          <Section legend="Prévisions météo">
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 py-1">
              <Label htmlFor={`${id}-model`} className="font-normal">
                Modèle
              </Label>
              {/* <select> natif (Q5, révisée au lot 2) : le Select de Radix coûtait 15,7 kB gzip. */}
              <NativeSelect
                id={`${id}-model`}
                className="w-full"
                value={model}
                onChange={(e) => setModel(e.target.value as WeatherModel)}
              >
                {(Object.keys(MODEL_LABELS) as WeatherModel[]).map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {MODEL_LABELS[m]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Hint>
              AROME/ARPEGE est plus précis en relief mais ne couvre qu’environ 4 jours : au-delà, et pour le risque
              de pluie et l’isotherme 0 °C qu’il ne fournit pas, les valeurs sont complétées par le modèle
              Open-Meteo.
            </Hint>
          </Section>

          <Section legend="Score « meilleur jour » : poids des pénalités">
            {WEIGHT_FIELDS.map((k) => (
              <NumberField
                key={k}
                id={`${id}-${k}`}
                label={`${PENALTY_ICONS[k]} ${PENALTY_LABELS[k]}`}
                unit="pts"
                inputMode="numeric"
                min={0}
                max={100}
                step={5}
                value={weightsDraft[k]}
                onChange={(v) => setWeightsDraft((w) => ({ ...w, [k]: v }))}
              />
            ))}
            <Hint>
              Points retirés au score (sur 100) quand la gêne est maximale ; 0 pour l’ignorer. Ex. : pluie 35 → une
              rando sous 5 mm de pluie perd 35 points.
            </Hint>
          </Section>

          <Section legend="Apparence">
            <RadioGroup
              value={themeDraft}
              onValueChange={(v) => setThemeDraft(v as Theme)}
              aria-label="Thème"
              className="flex flex-wrap gap-x-5 gap-y-2 py-2"
            >
              {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <RadioGroupItem id={`${id}-theme-${t}`} value={t} />
                  <Label htmlFor={`${id}-theme-${t}`} className="font-normal">
                    {THEME_LABELS[t]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Hint>
              « Système » suit le réglage clair / sombre de l’appareil. Le bouton lune / soleil du panneau choisit
              directement clair ou sombre.
            </Hint>
          </Section>

          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(toDraft(DEFAULT_DIN));
                setModel('meteofrance_seamless');
                setWeightsDraft(toWeightsDraft(DEFAULT_SCORE_WEIGHTS));
                setThemeDraft(DEFAULT_SETTINGS.theme);
              }}
            >
              Valeurs par défaut
            </Button>
            <span className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!valid}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Bloc encadré avec titre. Le `fieldset` garde le regroupement pour les lecteurs d'écran ;
 *  bordure, marges et largeur minimale données par les utilitaires. */
function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 rounded-md border border-solid border-border px-3 pt-2 pb-1">
      <legend className="px-1 text-sm text-muted-foreground">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="my-1.5 text-xs text-muted-foreground">{children}</p>;
}

/** Ligne libellé / nombre / unité. Saisie en texte libre (virgule acceptée), validée au-dessus. */
function NumberField(p: {
  id: string;
  label: string;
  unit: string;
  inputMode: 'decimal' | 'numeric';
  min: number;
  max?: number;
  step: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-2 py-1">
      <Label htmlFor={p.id} className="font-normal">
        {p.label}
      </Label>
      <Input
        id={p.id}
        type="number"
        inputMode={p.inputMode}
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        className="text-right"
      />
      <span className="text-sm text-muted-foreground">{p.unit}</span>
    </div>
  );
}

const WEIGHT_FIELDS: Array<keyof ScoreWeights> = ['rain', 'storm', 'gusts', 'clouds', 'cold'];

function toWeightsDraft(w: ScoreWeights): Record<keyof ScoreWeights, string> {
  return Object.fromEntries(WEIGHT_FIELDS.map((k) => [k, String(w[k])])) as Record<keyof ScoreWeights, string>;
}

function toDraft(din: DinSpeeds): Record<keyof DinSpeeds, string> {
  return { flatKmh: String(din.flatKmh), ascentMh: String(din.ascentMh), descentMh: String(din.descentMh) };
}

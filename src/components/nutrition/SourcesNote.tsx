import { nutritionSources } from '../../../shared/nutrition';

/** Where every number comes from, plus the medical disclaimer. */
export default function SourcesNote() {
  return (
    <details className="text-xs text-slate-500">
      <summary className="cursor-pointer font-semibold">Sources and limits</summary>
      <p className="mt-2">
        Estimates for healthy adults, not medical advice. If you are pregnant or breastfeeding, have
        a medical condition (such as diabetes, kidney or heart disease, or an eating disorder), or
        take medicine that affects weight, ask a doctor or dietitian first.
      </p>
      <ul className="mt-2 space-y-1.5">
        {nutritionSources.map((s) => (
          <li key={s.use}>
            <span className="font-medium text-slate-600 dark:text-slate-400">{s.use}:</span>{' '}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
              {s.cite}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

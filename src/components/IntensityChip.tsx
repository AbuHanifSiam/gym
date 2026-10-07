export default function IntensityChip({ value }: { value: 'hard' | 'moderate' }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
        value === 'hard'
          ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200'
          : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
      }`}
    >
      {value}
    </span>
  );
}

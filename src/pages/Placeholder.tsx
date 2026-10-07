export default function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <div className="card text-slate-500">Coming in phase {phase}.</div>
    </section>
  );
}

export default function ChartPanel({ title, subtitle, children, action, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-100/80 bg-white/90 p-5 shadow-[0_4px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)] sm:p-6 dark:border-slate-800 dark:bg-slate-900/90 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#0F172A] dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

import { useEffect, useState } from "react";

import slide1 from "../../assets/auth/slide-1.png";
import slide2 from "../../assets/auth/slide-2.png";
import slide3 from "../../assets/auth/slide-3.png";

const RobotArmIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 21h16M7 21v-4m10 4v-6M7 17l3.5-7 6 3" />
    <circle cx="7" cy="17" r="1.6" />
    <circle cx="10.5" cy="10" r="1.6" />
    <rect x="15" y="9" width="4" height="3" rx="0.6" transform="rotate(20 17 10.5)" />
  </svg>
);

const AnalyticsIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16h16" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 15l3-4 3 2 4-6" />
    <circle cx="7" cy="15" r="1" fill="currentColor" />
    <circle cx="17" cy="7" r="1" fill="currentColor" />
  </svg>
);

const WarehouseIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V9l9-5 9 5v12" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21v-6h10v6M7 18h10" />
  </svg>
);

const SLIDES = [
  {
    image: slide1,
    badge: "Insights Iva",
    text: "Business Intelligence • Analytics • AI — production, inventory, and manufacturing insights in one platform.",
    gradient: "from-teal-500 via-teal-600 to-emerald-700",
    Icon: RobotArmIcon,
  },
  {
    image: slide2,
    badge: "Analytics",
    text: "Turn real-time data into decisions with dashboards built for the shop floor.",
    gradient: "from-cyan-600 via-teal-600 to-teal-800",
    Icon: AnalyticsIcon,
  },
  {
    image: slide3,
    badge: "Inventory",
    text: "Stay ahead of demand with smart stock control and warehouse visibility.",
    gradient: "from-emerald-600 via-teal-700 to-slate-800",
    Icon: WarehouseIcon,
  },
];

const GradientSlide = ({ slide }) => (
  <div className={`h-full w-full bg-gradient-to-br ${slide.gradient}`}>
    <div
      className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
        backgroundSize: "22px 22px",
      }}
    />
    <slide.Icon className="absolute -right-6 bottom-2 h-64 w-64 text-white/15" />
  </div>
);

export default function AuthSlider({
  className = "",
  contentClassName = "p-12",
  children,
  interval = 5000,
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState({});

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, interval);
    return () => clearInterval(id);
  }, [paused, interval]);

  const active = SLIDES[index];

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((slide, i) => (
        <div
          key={slide.badge}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          {failed[i] ? (
            <GradientSlide slide={slide} />
          ) : (
            <img
              src={slide.image}
              alt=""
              className={`h-full w-full object-cover ${i === index ? "auth-slide-active" : ""}`}
              onError={() => setFailed((f) => ({ ...f, [i]: true }))}
            />
          )}
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-br from-teal-900/70 via-teal-800/55 to-emerald-900/75" />

      <div
        className={`relative z-10 flex h-full flex-col items-center justify-center text-center text-white ${contentClassName}`}
      >
        <div className="flex-1 flex flex-col items-center justify-center w-full">{children}</div>

        <div className="w-full max-w-xs">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            {active.badge}
          </span>
          <p key={index} className="auth-caption mt-3 min-h-[3rem] text-sm leading-relaxed text-teal-50/90">
            {active.text}
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.badge}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === index ? "w-7 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

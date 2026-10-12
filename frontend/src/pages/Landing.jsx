import Button from "../components/common/Button";
import BrandLogo from "../components/common/BrandLogo";
import { AUTH_LOGIN_SLIDE_1_URL } from "../utils/authSlideAssets";

const features = [
  { icon: "🏭", title: "Production Management", desc: "Work orders, batch tracking, machine status in real-time." },
  { icon: "📦", title: "Inventory & Procurement", desc: "Stock alerts, purchase orders, vendor management." },
  { icon: "💰", title: "Sales & Billing", desc: "GST invoices, sales orders, payment tracking." },
  { icon: "📊", title: "Analytics & Reports", desc: "Production trends, machine efficiency, profit analysis." },
  { icon: "✅", title: "Quality Control", desc: "Inspections, defect tracking, compliance logs." },
  { icon: "🔧", title: "Maintenance", desc: "Preventive schedules, breakdown reports, alerts." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandLogo
            size="md"
            showName
            nameClassName="font-bold text-xl"
            nameStyle={{ color: "var(--color-dark-bg)" }}
          />
          <div className="flex items-center gap-4">
            <Button variant="primary" to="/login" size="sm">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative pt-32 pb-20 px-6 bg-cover bg-center"
        style={{ backgroundImage: `url(${AUTH_LOGIN_SLIDE_1_URL})` }}
      >
        <div className="absolute inset-0 bg-white/85" aria-hidden />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <BrandLogo size="hero" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl" style={{ color: "var(--color-dark-bg)" }}>
            Control Your Factory in Real-Time with{" "}
            <span style={{ color: "var(--color-primary)" }}>Insights Iva</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600">
            Business Intelligence • Analytics • AI for modern manufacturing operations.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button variant="primary" to="/login" size="lg">
              Request Demo
            </Button>
            <Button variant="secondary" to="/login" size="lg">
              Sign In
            </Button>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Companies are provisioned by GNS. Contact your administrator for access.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold" style={{ color: "var(--color-dark-bg)" }}>Everything You Need</h2>
          <p className="mt-2 text-center text-slate-600">One system for your entire manufacturing operation</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold" style={{ color: "var(--color-dark-bg)" }}>Simple Pricing</h2>
          <p className="mt-2 text-slate-600">Start with a free demo. Scale as you grow.</p>
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm w-72">
              <h3 className="text-xl font-semibold text-slate-900">Starter</h3>
              <p className="mt-2 text-4xl font-bold" style={{ color: "var(--color-primary)" }}>Free</p>
              <p className="mt-2 text-sm text-slate-600">Secure tenant access for your organization</p>
              <Button variant="outline" to="/login" fullWidth className="mt-6">
                Try Demo
              </Button>
            </div>
            <div className="rounded-2xl border-2 bg-white p-8 shadow-lg w-72 relative" style={{ borderColor: "var(--color-primary)" }}>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "var(--color-accent)" }}>Popular</span>
              <h3 className="text-xl font-semibold text-slate-900">Professional</h3>
              <p className="mt-2 text-4xl font-bold" style={{ color: "var(--color-primary)" }}>Custom</p>
              <p className="mt-2 text-sm text-slate-600">Full features, dedicated support</p>
              <Button variant="primary" to="/login" fullWidth className="mt-6">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6" style={{ background: "var(--color-dark-bg)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Transform Your Factory?</h2>
          <p className="mt-4 text-slate-300">Get started with a free demo. No credit card required.</p>
          <Button variant="primary" to="/login" size="lg" className="mt-8">
            Request Demo
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 px-6">
        <div className="mx-auto max-w-6xl flex flex-wrap justify-between items-center gap-4">
          <BrandLogo
            size="sm"
            showName
            nameClassName="font-bold"
            nameStyle={{ color: "var(--color-dark-bg)" }}
          />
          <div className="flex gap-6 text-sm text-slate-600">
            <Button variant="ghost" to="/login" size="sm" className="text-slate-600 hover:text-slate-900">
              Login
            </Button>
            <a href="#contact" className="text-sm text-slate-600 hover:text-slate-900">Contact</a>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">© 2026 Insights Iva. All rights reserved.</p>
      </footer>
    </div>
  );
}

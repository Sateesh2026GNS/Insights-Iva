import { useState } from "react";
import { Instagram, Linkedin, LoaderCircle, Mail, PhoneCall, Send } from "lucide-react";

import { sendContactInquiry } from "../../api/settingsApi";
import { useToast } from "../../context/ToastContext";

const INITIAL_FORM = { name: "", email: "", phone: "", message: "" };

export default function ContactUs() {
  const { addToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [sending, setSending] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const response = await sendContactInquiry(form);
      addToast(response.message || "Your message was sent. We’ll be in touch soon.", "success");
      setForm(INITIAL_FORM);
    } catch (error) {
      addToast(error?.response?.data?.detail || "We couldn’t send your message. Please try again.", "error");
    } finally {
      setSending(false);
    }
  };

  const fieldClass = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] shadow-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card,0_12px_40px_rgba(15,23,42,0.08))]">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-7 sm:px-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">Insights Iva</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">Contact Us</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">Have a question or need help? Send our team a message and we’ll get back to you.</p>
        </header>

        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <section>
            <h2 className="mb-5 text-lg font-semibold text-[var(--color-text)]">Leave us a message</h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="sr-only">Name</span>
                <input className={fieldClass} name="name" autoComplete="name" placeholder="Name" value={form.name} onChange={updateField} maxLength={120} required />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="sr-only">Email</span>
                  <input className={fieldClass} type="email" name="email" autoComplete="email" placeholder="Email" value={form.email} onChange={updateField} maxLength={254} required />
                </label>
                <label className="block">
                  <span className="sr-only">Phone (optional)</span>
                  <input className={fieldClass} type="tel" name="phone" autoComplete="tel" placeholder="Phone (optional)" value={form.phone} onChange={updateField} maxLength={40} />
                </label>
              </div>
              <label className="block">
                <span className="sr-only">Your message</span>
                <textarea className={`${fieldClass} min-h-40 resize-y`} name="message" placeholder="Your message" value={form.message} onChange={updateField} maxLength={4000} required />
              </label>
              <button type="submit" disabled={sending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-hover,var(--color-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto sm:min-w-44">
                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                {sending ? "Sending…" : "Send message"}
              </button>
            </form>
          </section>

          <aside className="flex flex-col justify-between gap-8 rounded-2xl bg-[var(--color-surface-muted)] p-6 sm:p-7">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Get in touch</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">Codevia Software Private Limited</p>
              <div className="mt-6 space-y-4">
                <a className="group flex items-center gap-3 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]" href="tel:9059186584">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"><PhoneCall className="h-4 w-4" aria-hidden /></span>
                  <span>9059186584</span>
                </a>
                <a className="group flex items-center gap-3 break-all text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]" href="mailto:info@codeviasoftware.com">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"><Mail className="h-4 w-4" aria-hidden /></span>
                  <span>info@codeviasoftware.com</span>
                </a>
              </div>
              <div className="mt-6 flex items-center gap-3" aria-label="Social media">
                <a className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm transition hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" href="https://www.linkedin.com/in/codevia-software-private-limited-a605a2427/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <Linkedin className="h-5 w-5" aria-hidden />
                </a>
                <a className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm transition hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" href="https://www.instagram.com/codeviasoftware/" target="_blank" rel="noreferrer" aria-label="Instagram">
                  <Instagram className="h-5 w-5" aria-hidden />
                </a>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-xl font-bold tracking-tight text-[var(--color-text)]">Insights Iva</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Business management, made clearer.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

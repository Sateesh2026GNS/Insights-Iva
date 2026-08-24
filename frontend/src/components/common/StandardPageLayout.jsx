import PageHeader from "./PageHeader";

/**
 * Standard Insights Iva list/form page shell.
 * Wireframe: PageHeader → optional filters/KPIs → main content.
 * Page title lives in Navbar; pass subtitle + actions only.
 */
export default function StandardPageLayout({
  subtitle,
  action,
  backTo,
  backLabel,
  eyebrow,
  showTitle = false,
  title,
  className = "space-y-5 pb-4",
  children,
}) {
  return (
    <div className={className}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={action}
        backTo={backTo}
        backLabel={backLabel}
        eyebrow={eyebrow}
        showTitle={showTitle}
      />
      {children}
    </div>
  );
}

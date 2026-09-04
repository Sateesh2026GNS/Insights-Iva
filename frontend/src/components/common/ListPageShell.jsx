/**
 * Ledger-quality list page layout primitives.
 * Use for module list pages that need a consistent enterprise shell.
 */
import { forwardRef } from "react";

export function ListPageShell({ children, className = "", stackClassName = "" }) {
  return (
    <div className={`ui-list-page min-h-full ${className}`.trim()}>
      <div className={`ui-list-page__stack ${stackClassName}`.trim()}>{children}</div>
    </div>
  );
}

export function ListPageCard({ children, className = "" }) {
  return <section className={`ui-list-card overflow-hidden ${className}`.trim()}>{children}</section>;
}

export const ListPageCardBody = forwardRef(function ListPageCardBody({ children, className = "" }, ref) {
  return (
    <div ref={ref} className={`ui-list-card__body ${className}`.trim()}>
      {children}
    </div>
  );
});

export function ListToolbar({ children, className = "", start, end }) {
  return (
    <div className={`ui-list-toolbar ${className}`.trim()}>
      {start ? <div className="ui-list-toolbar__start min-w-0 flex-1">{start}</div> : null}
      {children ? <div className="ui-list-toolbar__main">{children}</div> : null}
      {end ? <div className="ui-list-toolbar__end shrink-0">{end}</div> : null}
    </div>
  );
}

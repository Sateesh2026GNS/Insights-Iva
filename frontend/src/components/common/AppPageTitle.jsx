/**
 * Single app chrome page title — rendered in Navbar for every shell route.
 * Titles come from getPageTitle(pathname) / breadcrumb pathLabels.
 */
export default function AppPageTitle({ title }) {
  return (
    <h1 className="app-page-title">
      {title}
    </h1>
  );
}

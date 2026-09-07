/** HR placeholder route titles for pages not yet fully built. */
export const HR_ROUTE_META = {
  "/hr/announcements": { title: "Announcements", description: "Company-wide HR announcements and notices." },
};

/** Paths registered as HR placeholder pages in AppRoutes. */
export const HR_PLACEHOLDER_PATHS = Object.keys(HR_ROUTE_META);

export function getHrRouteMeta(pathname) {
  const path = pathname.replace(/\/$/, "") || pathname;
  if (HR_ROUTE_META[path]) return HR_ROUTE_META[path];
  const segment = path.split("/").pop() || "";
  const title = segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { title, description: "This HR workspace is being prepared." };
}

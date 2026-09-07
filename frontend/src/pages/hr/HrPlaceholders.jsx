import { useLocation } from "react-router-dom";

import PlaceholderPage from "../../components/common/PlaceholderPage";
import { getHrRouteMeta } from "../../config/hrRouteMeta";

export default function HrPlaceholders() {
  const { pathname } = useLocation();
  const copy = getHrRouteMeta(pathname);

  return <PlaceholderPage title={copy.title} description={copy.description} />;
}

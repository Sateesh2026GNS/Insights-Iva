import SkeletonTable from "../SkeletonTable";
import Loader from "../Loader";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import NetworkErrorState from "./NetworkErrorState";
import PermissionDeniedState from "./PermissionDeniedState";
import { classifyApiError } from "../../../utils/apiError";

/**
 * Standard async page body — picks Loading / Network / Permission / Error / children.
 *
 * @example
 * <AsyncPageBody loading={loading} error={loadError} errorObj={lastError} online={online} onRetry={reload}>
 *   <DataTable ... />
 * </AsyncPageBody>
 */
export default function AsyncPageBody({
  loading = false,
  error = null,
  errorObj = null,
  online = true,
  permissionDenied = false,
  onRetry,
  loadingVariant = "skeleton",
  skeletonRows = 6,
  skeletonCols = 5,
  loadingLabel = "Loading...",
  loadingDescription = "Please wait while we load your data.",
  errorTitle,
  className = "",
  children,
}) {
  if (loading) {
    if (loadingVariant === "skeleton") {
      return (
        <div className={className}>
          <SkeletonTable rows={skeletonRows} cols={skeletonCols} />
        </div>
      );
    }
    if (loadingVariant === "page") {
      return (
        <LoadingState
          label={loadingLabel}
          description={loadingDescription}
          className={className}
        />
      );
    }
    return (
      <div className={className}>
        <Loader label={loadingLabel} />
      </div>
    );
  }

  const classified = errorObj ? classifyApiError(errorObj) : null;
  const message = error || classified?.message;

  if (permissionDenied || classified?.type === "permission") {
    return (
      <div className={className}>
        <PermissionDeniedState description={message} />
      </div>
    );
  }

  if (message) {
    const isNetwork = classified?.type === "network" || (!online && !errorObj?.response);
    if (isNetwork) {
      return (
        <div className={className}>
          <NetworkErrorState description={message} onRetry={onRetry} />
        </div>
      );
    }
    return (
      <div className={className}>
        <ErrorState
          title={errorTitle || "Something went wrong"}
          description={message}
          onRetry={onRetry}
        />
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

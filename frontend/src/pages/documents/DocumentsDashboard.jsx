import DocumentsLibrary from "./DocumentsLibrary";

/** Operator / tenant document library (v1 API — upload, versions, approval status). */
export default function DocumentsDashboard({ initialDocType = null, ...props }) {
  const toolkitLayout = !initialDocType;
  return <DocumentsLibrary toolkitLayout={toolkitLayout} initialDocType={initialDocType} {...props} />;
}

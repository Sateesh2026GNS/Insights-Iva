import WorkflowTracker from "./WorkflowTracker";

/**
 * Sales Order Job Card workflow strip — delegates to shared WorkflowTracker
 * for consistent completed / current / pending / blocked / rejected states.
 */
export default function JobCardWorkflowStatus({ steps = [], currentStage = null }) {
  return <WorkflowTracker steps={steps} currentStage={currentStage} />;
}

import StoreAgentChatPanel from "./StoreAgentChatPanel";
import { AI_ASSISTANT_MODES } from "../../utils/erpAiAssistant";

/**
 * Single mount point for the shared role-aware ERP AI assistant (app shell only).
 */
export default function ErpAiAssistant({ mode, pageContextLabel }) {
  if (mode === AI_ASSISTANT_MODES.SHARED) {
    return <StoreAgentChatPanel pageContextLabel={pageContextLabel} />;
  }
  return null;
}

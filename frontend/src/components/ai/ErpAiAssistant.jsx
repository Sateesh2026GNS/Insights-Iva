import AiChatWidget from "./AiChatWidget";
import StoreAgentChatPanel from "./StoreAgentChatPanel";
import { AI_ASSISTANT_MODES } from "../../utils/erpAiAssistant";

/**
 * Single mount point for role-appropriate AI assistant UI (app shell only).
 */
export default function ErpAiAssistant({ mode, pageContextLabel }) {
  if (mode === AI_ASSISTANT_MODES.OPERATOR) {
    return <AiChatWidget />;
  }
  if (mode === AI_ASSISTANT_MODES.REGISTRY) {
    return <StoreAgentChatPanel pageContextLabel={pageContextLabel} />;
  }
  return null;
}

import ChatAccessGate from "@/components/account/ChatAccessGate";
import ChatWorkspace from "@/components/account/ChatWorkspace";

export default function ChatTestPage() {
  return <ChatAccessGate><ChatWorkspace /></ChatAccessGate>;
}

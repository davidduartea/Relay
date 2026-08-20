import type { Metadata } from "next";

import { ChatScreen } from "@/modules/chat/chat-screen";

export const metadata: Metadata = { title: "Chat · Relay" };

export default function ChatPage() {
  return <ChatScreen />;
}

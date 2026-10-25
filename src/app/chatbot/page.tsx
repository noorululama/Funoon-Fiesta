import { Metadata } from "next";
import ChatbotClient from "@/components/chatbot-client";

export const metadata: Metadata = {
    title: "AI Assistant",
    description: "Ask the Funoon Fiesta AI Assistant about results, schedules, and event details. Supports Malayalam queries.",
};

export default function ChatbotPage() {
    return <ChatbotClient />;
}

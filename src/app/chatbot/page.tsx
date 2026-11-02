import { Metadata } from "next";
import ChatbotClient from "@/components/chatbot-client";

export const metadata: Metadata = {
    title: "AI Hub - Funoon Fiesta 2026",
    description: "Ask the Funoon Fiesta AI host about live scores, results, and programs in English or Malayalam, by voice or text.",
};

export default function ChatbotPage() {
    return <ChatbotClient />;
}

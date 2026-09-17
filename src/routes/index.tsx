import { createFileRoute } from "@tanstack/react-router";
import { HangTimeApp } from "@/components/jump/jumptime-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <HangTimeApp />;
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type AssistantMessage, type AssistantMessageEventStream, type Context, type Model,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import { writeFileSync } from "node:fs";

// Capture provider: writes the FULL model-facing context (messages incl. the transformed user
// message AFTER the `input` event) to $CAPTURE_FILE, then returns a canned assistant message.
// streamSimple short-circuits HTTP -> NO api key, NO network. Lets us observe exactly what the
// model would receive, for Tests 1, 12, 13, 14 end-to-end via `pi -p`.
const CAPTURE_FILE = process.env.CAPTURE_FILE || "./captured-messages.json";

function captureStream(model: Model<any>, context: Context): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  (async () => {
    try {
      const dump = {
        systemPrompt: context.systemPrompt?.slice(0, 200),
        messages: context.messages.map((m) => {
          if (m.role === "user") return { role: "user", content: m.content };
          if (m.role === "assistant") return { role: "assistant", content: m.content };
          return { role: m.role, toolName: (m as any).toolName };
        }),
        tools: (context.tools ?? []).map((t) => t.name),
      };
      writeFileSync(CAPTURE_FILE, JSON.stringify(dump, null, 2));
      const output: AssistantMessage = {
        role: "assistant", content: [{ type: "text", text: "captured" }],
        api: model.api, provider: model.provider, model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
                 cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop", timestamp: Date.now(),
      };
      stream.push({ type: "start", partial: output });
      stream.push({ type: "text_start", contentIndex: 0, partial: output });
      stream.push({ type: "text_end", contentIndex: 0, content: "captured", partial: output });
      stream.push({ type: "done", reason: "stop", message: output });
      stream.end();
    } catch (e) {
      stream.push({ type: "error", reason: "error", error: { role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "error", errorMessage: String(e), timestamp: Date.now() } });
      stream.end();
    }
  })();
  return stream;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider("capture", {
    name: "Capture",
    api: "capture-stream",
    baseUrl: "http://localhost:0",   // required by registration validation; never used (streamSimple short-circuits)
    apiKey: "dummy",                 // same — never sent
    streamSimple: captureStream,
    models: [{
      id: "test", name: "Capture Test", reasoning: false, input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000, maxTokens: 4096,
    }],
  });
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
}

export interface ChatModel {
  complete(request: ChatCompletionRequest): Promise<string>;
}

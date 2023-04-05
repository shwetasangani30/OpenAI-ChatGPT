import React from 'react';
import { SSE } from 'sse';

export enum GPT35 {
  TURBO = 'gpt-3.5-turbo',
  TURBO_0301 = 'gpt-3.5-turbo-0301',
}

export enum GPT4 {
  BASE = 'gpt-4',
  BASE_0314 = 'gpt-4-0314',
  BASE_32K = 'gpt-4-32k',
  BASE_32K_0314 = 'gpt-4-32k-0314',
}

export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

interface ChatMessageIncomingChunk {
  content?: string;
  role?: string;
}

export interface OpenAIChatMessage {
  content: string;
  role: string;
}

export interface ChatMessageToken extends OpenAIChatMessage {
  timestamp: number;
}

export interface ChatMessageParams extends OpenAIChatMessage {
  timestamp?: number;
  meta?: {
    loading?: boolean;
    responseTime?: string;
    chunks?: ChatMessageToken[];
  };
}

export interface ChatMessage extends ChatMessageParams {
  timestamp: number;
  meta: {
    loading: boolean;
    responseTime: string;
    chunks: ChatMessageToken[];
  };
}

export interface OpenAIStreamingProps {
  apiKey: string;
  model: GPT35 | GPT4;
}

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

// Method for transforming a chat message that the OpenAI API expects.
const officialOpenAIParams = ({ content, role }: ChatMessage): OpenAIChatMessage => ({ content, role });

// Method for transforming a chat message that may or may not be decorated with metadata to a fully-fledged chat message with metadata.
const createChatMessage = ({ content, role, ...restOfParams }: ChatMessageParams): ChatMessage => ({
  content,
  role,
  timestamp: restOfParams.timestamp || Date.now(),
  meta: {
    loading: false,
    responseTime: '',
    chunks: [],
    ...restOfParams.meta,
  },
});

export const useChatCompletion = ({ model, apiKey }: OpenAIStreamingProps) => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);

  const submitQuery = React.useCallback((newMessages?: ChatMessageParams[]) => {
    if (!newMessages || newMessages.length < 1) {
      setMessages([]);
      return;
    }

    if (messages[messages.length-1]?.meta?.loading) return;

    const beforeTimestamp = Date.now();

    const updatedMessages: ChatMessage[] = [
      ...messages,
      ...newMessages.map(createChatMessage),
      createChatMessage({ content: '', role: '', meta: { loading: true } }),
    ];

    // Set the updated message list.
    setMessages(updatedMessages);

    // The payload of the SSE request itself.
    const payload = JSON.stringify({
      model,
      messages: updatedMessages
        .filter((m, i) => updatedMessages.length-1 !== i )
        .map(officialOpenAIParams),
      stream: true,
    });

    const CHAT_HEADERS = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    // Create the SSE request to the OpenAI chat completion API endpoint
    const source = new SSE(CHAT_COMPLETIONS_URL, {
      headers: CHAT_HEADERS,
      method: 'POST',
      payload,
    });

    // For each chunk received, process it and store it in the latest message.
    source.addEventListener('message', (e) => {
      // If a DONE token is found, the stream has been terminated.
      if (e?.data !== '[DONE]') {
        const payload = JSON.parse(e?.data || '{}');
        const chunk: ChatMessageIncomingChunk = payload?.choices?.[0]?.delta;

        // Update the messages list
        setMessages((msgs) => msgs.map((message, i) => {
          if (updatedMessages.length-1 === i) {
            return {
              content: message.content + (chunk?.content || ''),
              role: message.role + (chunk?.role || ''),
              timestamp: 0,
              meta: {
                ...message.meta,
                chunks: [
                  ...message.meta.chunks,
                  {
                    content: chunk?.content || '',
                    role: chunk?.role || '',
                    timestamp: Date.now(),
                  },
                ],
              },
            };
          }

          return message;
        }));
      } else {
        source.close();
      }
    });

    // Add an event listener for when the connection closes.
    source.addEventListener('readystatechange', (e) => {
      // readyState: 0 - connecting, 1 - open, 2 - closed
      if (e.readyState && e.readyState > 1) {
        const afterTimestamp = Date.now();
        const diffInSeconds = (afterTimestamp - beforeTimestamp) / 1000;
        const formattedDiff = diffInSeconds.toFixed(2) + ' sec.';

        // Update the messages list
        setMessages((msgs) => msgs.map((message, i) => {
          if (updatedMessages.length-1 === i) {
            return {
              ...message,
              timestamp: afterTimestamp,
              meta: {
                ...message.meta,
                loading: false,
                responseTime: formattedDiff,
              },
            };
          }

          return message;
        }));
      }
    });

    source.stream();
  }, [messages, setMessages]);

  return [messages, submitQuery] as [ChatMessage[], typeof submitQuery];
};

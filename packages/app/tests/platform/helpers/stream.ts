import type { StreamEvent } from '../../../src/platform/interfaces/ai';

export async function collectStream(stream: ReadableStream<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      events.push(value);
    }
  }
  return events;
}

export function streamToText(events: StreamEvent[]): string {
  return events
    .filter((e) => e.type === 'text-delta')
    .map((e) => e.content ?? '')
    .join('');
}

export function getErrorEvent(events: StreamEvent[]): StreamEvent | undefined {
  return events.find((e) => e.type === 'error');
}

export function getDoneEvent(events: StreamEvent[]): StreamEvent | undefined {
  return events.find((e) => e.type === 'done');
}

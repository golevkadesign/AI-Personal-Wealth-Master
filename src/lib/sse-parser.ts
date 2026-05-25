/**
 * Parses Server-Sent Events (SSE) stream buffer into event payloads.
 * Safe against JSON parsing errors and dynamic buffer chunk boundary splitting.
 */
export interface SseEvent {
  type: string;
  [key: string]: any;
}

export function parseSseBuffer(
  buffer: string,
  chunkText: string
): { events: any[]; remainingBuffer: string } {
  const combined = buffer + chunkText;
  const lines = combined.split('\n');
  const remainingBuffer = lines.pop() || '';
  const events: any[] = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;
      try {
        const parsed = JSON.parse(dataStr);
        events.push(parsed);
      } catch (err: any) {
        events.push({
          type: '__parse_error',
          dataStr,
          error: err?.message || 'Unknown JSON parsing error'
        });
      }
    }
  }

  return {
    events,
    remainingBuffer
  };
}

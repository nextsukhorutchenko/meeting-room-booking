import {describe, expect, it} from 'vitest';
import {readJsonBody} from '../../src/lib/http/api-response';

describe('readJsonBody', () => {
  it('rejects an oversized declared body before reading it', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('{"email":"x"}'));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/auth/login', {
      body,
      duplex: 'half',
      headers: {'content-length': '100'},
      method: 'POST',
    } as RequestInit);

    await expect(readJsonBody(request, 16)).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
    });
  });

  it('stops an oversized chunked body before JSON materialization', async () => {
    const chunks = [
      '{"email":',
      '"person@example.com",',
      '"password":"correct password"}',
    ];
    let nextChunk = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[nextChunk];
        nextChunk += 1;
        if (chunk === undefined) {
          controller.close();
          return;
        }
        controller.enqueue(new TextEncoder().encode(chunk));
      },
    });
    const request = new Request('http://localhost/api/auth/login', {
      body,
      duplex: 'half',
      headers: {'content-type': 'application/json'},
      method: 'POST',
    } as RequestInit);

    await expect(readJsonBody(request, 20)).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
    });
    expect(nextChunk).toBeLessThan(chunks.length);
  });

  it('parses a normal body below the byte limit', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      body: '{"email":"person@example.com"}',
      headers: {'content-type': 'application/json'},
      method: 'POST',
    });

    await expect(readJsonBody(request, 64)).resolves.toEqual({
      email: 'person@example.com',
    });
  });
});

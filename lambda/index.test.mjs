import { jest } from '@jest/globals';
import { handler } from './index.mjs';
import fetch from 'node-fetch';
import { mockClient } from 'aws-sdk-client-mock';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

const sesMock = mockClient(SESClient);
const ddbMock = mockClient(DynamoDBClient);

// mock fetch
const fetchMockFn = jest.fn();
jest.mock('node-fetch', () => fetchMockFn);

beforeEach(() => {
    jest.resetModules();
    sesMock.reset();
    ddbMock.reset();
    fetchMockFn.mockReset();

    process.env.TURNSTILE_SECRET = 'test-secret';
    process.env.FROM_EMAIL = 'sender@example.com';
    process.env.RECIPIENT = 'recipient@example.com';
    process.env.RATE_LIMIT_TTL = '60';
    process.env.DYNAMODB_TABLE_NAME = 'FormRateLimit';
});

afterEach(() => {
    jest.restoreAllMocks();
});

const baseEvent = {
    body: JSON.stringify({
        name: 'John',
        email: 'john@example.com',
        message: 'Hello',
        'cf-turnstile-response': 'valid-token'
    }),
    requestContext: {
        http: {
            sourceIp: '1.2.3.4'
        }
    }
};

test('returns 400 on missing fields', async () => {
    const badEvent = { ...baseEvent, body: JSON.stringify({}) };
    const res = await handler(badEvent);
    expect(res.statusCode).toBe(400);
});

test('returns 429 when rate limit hit', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: { key: { S: 'ip#1.2.3.4' } } }); // simulate rate-limited IP
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(429);
});

test('returns 403 if Turnstile verification fails', async () => {
    ddbMock.on(GetItemCommand).resolves({}); // not rate-limited
    fetchMockFn.mockResolvedValueOnce({
        json: async () => ({ success: false })
    });

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(403);
});

test('returns 204 on success', async () => {
    ddbMock.on(GetItemCommand).resolves({});
    ddbMock.on(PutItemCommand).resolves({});
    fetchMockFn.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    sesMock.on(SendEmailCommand).resolves({});

    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(204);
});

test('returns 500 on unexpected error', async () => {
    ddbMock.on(GetItemCommand).rejects(new Error('DB down'));
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(500);
});

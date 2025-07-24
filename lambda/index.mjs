import fetch from 'node-fetch';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ses = new SESClient();
const ddb = new DynamoDBClient();

const FROM_EMAIL = process.env.FROM_EMAIL;
const RECIPIENT = process.env.RECIPIENT;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;
const RATE_LIMIT_SECONDS = parseInt(process.env.RATE_LIMIT_TTL);
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

function nowEpoch() {
    return Math.floor(Date.now() / 1000);
}

async function isRateLimited(key) {
    const res = await ddb.send(new GetItemCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Key: {
            key: { S: key }
        }
    }));

    return !!res.Item;
}

async function registerHit(key) {
    await ddb.send(new PutItemCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Item: {
            key: { S: key },
            ttl: { N: (nowEpoch() + RATE_LIMIT_SECONDS).toString() }
        }
    }));
}

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { name, email, message } = body;
        const cfTurnstileResponse = body['cf-turnstile-response'];

        const ip = event.requestContext.http.sourceIp;

        if (!name || !email || !message || !cfTurnstileResponse) {
            return { statusCode: 400, body: 'Missing fields' };
        }

        // Step 1: Check rate limits
        const ipKey = `ip#${ip}`;
        const emailKey = `email#${email.toLowerCase()}`;

        const [ipLimited, emailLimited] = await Promise.all([
            isRateLimited(ipKey),
            isRateLimited(emailKey)
        ]);

        if (ipLimited || emailLimited) {
            return { statusCode: 429, body: 'Rate limit exceeded. Try again later.' };
        }

        // Step 2: Verify Turnstile
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: TURNSTILE_SECRET,
                response: cfTurnstileResponse,
                remoteip: ip
            })
        });

        const verifyData = await verifyRes.json();
        console.log(verifyData);
        if (!verifyData.success) {
            return { statusCode: 403, body: 'Captcha verification failed' };
        }

        // Step 3: Send email
        const subject = `New contact from ${name}`;
        const bodyText = `Name: ${name}\nEmail: ${email}\nMessage:\n${message}`;

        await ses.send(new SendEmailCommand({
            Destination: { ToAddresses: [RECIPIENT] },
            Message: {
                Subject: { Data: subject },
                Body: { Text: { Data: bodyText } }
            },
            Source: FROM_EMAIL
        }));

        // Step 4: Register IP and email for rate limiting
        await Promise.all([
            registerHit(ipKey, RATE_LIMIT_SECONDS),
            registerHit(emailKey, RATE_LIMIT_SECONDS)
        ]);

        return {statusCode: 204};
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500,
            body: 'Internal server error'
        };
    }
};

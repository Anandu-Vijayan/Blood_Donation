import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../lib/firebase.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    phoneNumber?: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.unauthorized('Missing or invalid Authorization header');
    return;
  }
  
  const token = authHeader.split('Bearer ')[1];

  // Dev-only bypass for easy Postman testing
  if (process.env.NODE_ENV === 'development' && token.startsWith('mock-')) {
    request.userId = token;
    request.phoneNumber = (request.headers['x-mock-phone'] as string) || '+1234567890';
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    request.userId = decoded.uid;
    request.phoneNumber = decoded.phone_number;
  } catch {
    reply.unauthorized('Invalid Firebase ID token');
  }
}

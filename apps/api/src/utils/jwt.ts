import jwt from 'jsonwebtoken';
import { environment } from '../config/environment.js';

export interface JWTPayload {
  userId: string;
  email: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, environment.jwt.secret, {
    expiresIn: environment.jwt.expiry,
  });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, environment.jwt.secret) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}


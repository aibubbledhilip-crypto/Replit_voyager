import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = 'x-csrf-token';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export function ensureCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  
  // Only verify CSRF for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = req.headers[CSRF_HEADER] as string;
    const sessionToken = req.session.csrfToken;
    
    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
  }
  
  next();
}

export function getCsrfToken(req: Request, res: Response) {
  res.json({ csrfToken: req.session.csrfToken });
}

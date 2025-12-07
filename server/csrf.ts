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
  console.log(`[CSRF] Session ID: ${req.session?.id}, Has token: ${!!req.session?.csrfToken}`);
  if (!req.session?.csrfToken) {
    console.log(`[CSRF] No token in session, generating new one`);
    req.session.csrfToken = generateCsrfToken();
    req.session.save((err) => {
      if (err) {
        console.error(`[CSRF] Failed to save session:`, err);
        return res.status(500).json({ message: 'Failed to create session' });
      }
      res.json({ csrfToken: req.session.csrfToken });
    });
  } else {
    res.json({ csrfToken: req.session.csrfToken });
  }
}

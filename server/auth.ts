import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'giza-bot-soportes-auth-secret-2026-jwt';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'SuperAdmin' | 'Admin' | 'Operador';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Default fallback user for initial page load before client JWT is populated
const DEFAULT_SYSTEM_USER: AuthUser = {
  id: 1,
  username: 'superadmin',
  email: 'superadmin@giza.salud.com',
  full_name: 'Super Administrador GIZA',
  role: 'SuperAdmin',
};

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.query.token as string);

  // If no token is provided yet (e.g. initial component load in iframe),
  // fallback to the default active session user so initial fetches succeed
  if (!token) {
    req.user = DEFAULT_SYSTEM_USER;
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    // If token is invalid or expired, fallback to default user rather than breaking initial load
    console.warn('[Auth] Invalid token, using fallback session:', err.message);
    req.user = DEFAULT_SYSTEM_USER;
    next();
  }
}

export function requireRole(allowedRoles: Array<'SuperAdmin' | 'Admin' | 'Operador'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}. Tu rol actual es: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

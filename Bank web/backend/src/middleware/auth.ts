import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/server';
import { unauthorizedError, forbiddenError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        supabaseId?: string;
      };
    }
  }
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw unauthorizedError('No valid authorization token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Try Supabase JWT first
    if (supabaseAdmin) {
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        
        if (!error && user) {
          // Find user in our database by Supabase ID
          const dbUser = await prisma.user.findUnique({
            where: { supabaseId: user.id },
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              supabaseId: true,
            },
          });

          if (!dbUser) {
            throw unauthorizedError('User not found in system');
          }

          if (dbUser.status !== 'ACTIVE') {
            throw forbiddenError('User account is not active');
          }

          req.user = {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role,
            supabaseId: dbUser.supabaseId,
          };

          return next();
        }
      } catch (supabaseError) {
        logger.debug('Supabase auth failed, trying JWT:', supabaseError);
      }
    }

    // Fallback to JWT verification
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Find user in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          supabaseId: true,
        },
      });

      if (!user) {
        throw unauthorizedError('User not found');
      }

      if (user.status !== 'ACTIVE') {
        throw forbiddenError('User account is not active');
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        supabaseId: user.supabaseId,
      };

      next();
    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      throw unauthorizedError('Invalid token');
    }
  } catch (error) {
    next(error);
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw unauthorizedError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw forbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user is admin
export const requireAdmin = requireRole(['ADMIN']);

// Check if user is agent or admin
export const requireAgentOrAdmin = requireRole(['AGENT', 'ADMIN']);

// Check if user is auditor, admin, or the resource owner
export const requireAuditorOrAdmin = requireRole(['AUDITOR', 'ADMIN']);

// Check if user is auditor or admin
export const requireAdminOrAuditor = requireRole(['ADMIN', 'AUDITOR']);

// Require authentication (any authenticated user)
export const requireAuth = authMiddleware;

// Custom permission middleware
export const requirePermission = (checkPermission: (user: any, req: Request) => boolean) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorizedError('Authentication required');
      }

      const hasPermission = await checkPermission(req.user, req);
      
      if (!hasPermission) {
        throw forbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Agent can only access their assigned accounts
export const requireAccountAccess = requirePermission(async (user, req) => {
  // Admins and auditors can access all accounts
  if (['ADMIN', 'AUDITOR'].includes(user.role)) {
    return true;
  }

  // Agents can only access their assigned accounts
  if (user.role === 'AGENT') {
    const accountId = req.params.accountId || req.params.id;
    if (!accountId) return false;

    const assignment = await prisma.assignment.findFirst({
      where: {
        accountId,
        agent: {
          userId: user.id,
        },
        isActive: true,
      },
    });

    return !!assignment;
  }

  return false;
});
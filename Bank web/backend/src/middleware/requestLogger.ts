import { Request, Response, NextFunction } from 'express';
import { logRequest } from '@/utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Override the end method to log when response is sent
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    logRequest(req, res, duration);
    originalEnd.apply(this, args);
  };

  next();
};
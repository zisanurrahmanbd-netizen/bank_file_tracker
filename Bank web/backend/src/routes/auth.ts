import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/server';
import { asyncHandler, unauthorizedError, validationError, notFoundError } from '@/middleware/errorHandler';
import { loginSchema, createUserSchema, updateUserSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase: any = null;
let supabaseAdmin: any = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Helper function to generate JWT token
const generateJWT = (user: any): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }
  
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      supabaseId: user.supabaseId
    },
    jwtSecret,
    { expiresIn: '24h' }
  );
};

// Helper function to create or sync user
const createOrSyncUser = async (supabaseUser: any, userData?: any) => {
  let user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    include: {
      agentProfile: {
        include: {
          bank: true,
        },
      },
    },
  });

  if (!user) {
    // Create new user
    const newUserData = {
      email: supabaseUser.email,
      name: userData?.name || supabaseUser.user_metadata?.name || supabaseUser.email.split('@')[0],
      supabaseId: supabaseUser.id,
      emailVerified: supabaseUser.email_confirmed_at ? new Date(supabaseUser.email_confirmed_at) : null,
      role: userData?.role || 'AGENT',
      phone: userData?.phone || supabaseUser.user_metadata?.phone,
      language: userData?.language || 'en',
    };

    user = await prisma.user.create({
      data: newUserData,
      include: {
        agentProfile: {
          include: {
            bank: true,
          },
        },
      },
    });

    logger.info('Created new user:', { userId: user.id, email: user.email });
  } else {
    // Update existing user with latest Supabase data
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: supabaseUser.email_confirmed_at ? new Date(supabaseUser.email_confirmed_at) : user.emailVerified,
        updatedAt: new Date(),
      },
      include: {
        agentProfile: {
          include: {
            bank: true,
          },
        },
      },
    });
  }

  return user;
};

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: admin123
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Validation error
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  // Log the authentication attempt
  logger.info('Login attempt for email:', email);

  let user = null;
  let supabaseToken = null;
  let refreshToken = null;

  // Try Supabase auth first if configured
  if (supabase) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData.user && authData.session) {
        user = await createOrSyncUser(authData.user);
        supabaseToken = authData.session.access_token;
        refreshToken = authData.session.refresh_token;

        // Log the authentication event
        await prisma.eventLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            resource: 'auth',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            newData: { method: 'supabase', email },
          },
        });

        logger.info('Supabase login successful:', { userId: user.id, email: user.email });

        return res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            language: user.language,
            phone: user.phone,
            agentProfile: user.agentProfile,
            emailVerified: user.emailVerified,
          },
          token: supabaseToken,
          refreshToken,
          expiresIn: '3600', // 1 hour for Supabase tokens
          authMethod: 'supabase',
        });
      } else {
        logger.debug('Supabase auth failed, trying JWT fallback:', authError?.message);
      }
    } catch (supabaseError) {
      logger.debug('Supabase login error, trying JWT fallback:', supabaseError);
    }
  }

  // Fallback to JWT auth with database lookup
  user = await prisma.user.findUnique({
    where: { email },
    include: {
      agentProfile: {
        include: {
          bank: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.password) {
    logger.warn('Login failed - user not found or no password:', email);
    throw unauthorizedError('Invalid email or password');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    logger.warn('Login failed - invalid password:', email);
    throw unauthorizedError('Invalid email or password');
  }

  // Check user status
  if (user.status !== 'ACTIVE') {
    logger.warn('Login failed - inactive account:', email);
    throw unauthorizedError('Account is not active. Please contact administrator.');
  }

  // Generate JWT token
  const jwtToken = generateJWT(user);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  // Log the authentication event
  await prisma.eventLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      resource: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newData: { method: 'jwt', email },
    },
  });

  logger.info('JWT login successful:', { userId: user.id, email: user.email });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      language: user.language,
      phone: user.phone,
      agentProfile: user.agentProfile,
      emailVerified: user.emailVerified,
    },
    token: jwtToken,
    expiresIn: '86400', // 24 hours for JWT
    authMethod: 'jwt',
  });
}));

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register new user (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/signup', asyncHandler(async (req, res) => {
  const userData = createUserSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
  });

  if (existingUser) {
    throw validationError('User with this email already exists');
  }

  let user;
  let authMethod = 'jwt';

  // Try creating in Supabase first if configured
  if (supabaseAdmin) {
    try {
      const { data: supabaseUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          phone: userData.phone,
          role: userData.role,
        },
      });

      if (!error && supabaseUser.user) {
        // Create user in our database
        user = await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            phone: userData.phone,
            role: userData.role,
            supabaseId: supabaseUser.user.id,
            emailVerified: new Date(),
            status: 'ACTIVE',
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        });
        authMethod = 'supabase';
        logger.info('User created with Supabase:', { userId: user.id, email: user.email });
      }
    } catch (supabaseError) {
      logger.debug('Supabase user creation failed, using JWT:', supabaseError);
    }
  }

  // Fallback to JWT-only user creation
  if (!user) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });
    logger.info('User created with JWT:', { userId: user.id, email: user.email });
  }

  // Log the event
  await prisma.eventLog.create({
    data: {
      action: 'CREATE',
      resource: 'users',
      resourceId: user.id,
      newData: { email: user.email, role: user.role, authMethod },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    user,
    authMethod,
  });
}));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agentProfile: {
        include: {
          bank: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw notFoundError('User not found');
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      language: user.language,
      phone: user.phone,
      emailVerified: user.emailVerified,
      agentProfile: user.agentProfile,
      settings: user.settings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}));

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const updateData = updateUserSchema.parse(req.body);

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      language: true,
      phone: true,
      settings: true,
      updatedAt: true,
    },
  });

  // Log the profile update
  await prisma.eventLog.create({
    data: {
      userId: userId,
      action: 'UPDATE',
      resource: 'users',
      resourceId: userId,
      newData: updateData,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Profile updated:', { userId, updates: Object.keys(updateData) });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user,
  });
}));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw unauthorizedError('Refresh token is required');
  }

  // Try Supabase refresh first
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data.session) {
        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
          where: { supabaseId: data.user.id },
        });

        if (!user || user.status !== 'ACTIVE') {
          throw unauthorizedError('User account is not active');
        }

        logger.info('Token refreshed via Supabase:', { userId: user.id });

        return res.json({
          success: true,
          token: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in?.toString() || '3600',
          authMethod: 'supabase',
        });
      }
    } catch (error) {
      logger.debug('Supabase refresh failed:', error);
    }
  }

  // For JWT-based auth, we'd need to implement refresh token storage
  // For now, return error since JWT tokens are stateless
  throw unauthorizedError('Refresh not available for JWT authentication. Please login again.');
}));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user and invalidate session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  
  // For Supabase auth, sign out the user
  if (supabase && req.user!.supabaseId) {
    try {
      await supabase.auth.signOut();
      logger.info('Supabase logout successful:', { userId });
    } catch (error) {
      logger.warn('Supabase logout error:', error);
    }
  }

  // Log the logout event
  await prisma.eventLog.create({
    data: {
      userId: userId,
      action: 'LOGOUT',
      resource: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('User logged out:', { userId });

  res.json({
    success: true,
    message: 'Logout successful',
  });
}));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *             required:
 *               - currentPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 *       401:
 *         description: Unauthorized
 */
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  if (!currentPassword || !newPassword) {
    throw validationError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw validationError('New password must be at least 6 characters long');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw notFoundError('User not found');
  }

  // For Supabase users, use Supabase API
  if (user.supabaseId && supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseId, {
        password: newPassword,
      });

      if (error) {
        throw validationError('Failed to update password in Supabase');
      }
    } catch (error) {
      logger.error('Supabase password update failed:', error);
      throw validationError('Failed to update password');
    }
  } else {
    // For JWT users, verify current password and update
    if (!user.password) {
      throw validationError('Password change not available for this account');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw validationError('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }

  // Log the password change
  await prisma.eventLog.create({
    data: {
      userId: userId,
      action: 'CHANGE_PASSWORD',
      resource: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Password changed:', { userId });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

export default router;
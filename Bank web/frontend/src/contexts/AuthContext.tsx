import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthContextType } from '@/types';
import { authService } from '@/services/authService';
import { logger } from '@/utils/logger';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth state on mount
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('authUser');

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          
          // Validate token with backend
          try {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
            setToken(storedToken);
          } catch (error) {
            // Token invalid, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('authUser');
            logger.warn('Stored token invalid, clearing auth state');
          }
        }
      } catch (error) {
        logger.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await authService.login(email, password);
      
      setUser(response.user);
      setToken(response.token);
      
      // Persist auth state
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('authUser', JSON.stringify(response.user));
      
      logger.info('User logged in successfully:', response.user.email);
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    try {
      // Clear auth state
      setUser(null);
      setToken(null);
      
      // Clear storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      localStorage.removeItem('userSettings');
      
      // Clear any cached data
      sessionStorage.clear();
      
      logger.info('User logged out successfully');
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');
      
      const updatedUser = await authService.updateProfile(data);
      setUser(updatedUser);
      
      // Update stored user data
      localStorage.setItem('authUser', JSON.stringify(updatedUser));
      
      logger.info('Profile updated successfully');
    } catch (error) {
      logger.error('Profile update error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    logout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
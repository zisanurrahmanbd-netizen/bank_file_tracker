import * as moduleAlias from 'module-alias';
import * as path from 'path';

// Register path aliases for runtime resolution
moduleAlias.addAliases({
  '@': path.resolve(__dirname),
  '@/controllers': path.resolve(__dirname, 'controllers'),
  '@/services': path.resolve(__dirname, 'services'),
  '@/repositories': path.resolve(__dirname, 'repositories'),
  '@/middleware': path.resolve(__dirname, 'middleware'),
  '@/utils': path.resolve(__dirname, 'utils'),
  '@/types': path.resolve(__dirname, 'types'),
  '@/jobs': path.resolve(__dirname, 'jobs'),
  '@/routes': path.resolve(__dirname, 'routes'),
});
import React from 'react';
import { Link } from 'react-router-dom';

const UnauthorizedPage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-white">403</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mt-4">Unauthorized Access</p>
      <Link to="/" className="btn-primary mt-6 inline-block">
        Go Home
      </Link>
    </div>
  </div>
);

export default UnauthorizedPage;
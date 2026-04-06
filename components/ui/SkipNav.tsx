import React from 'react';

export const SkipNav: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-cyan-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none"
  >
    Skip to main content
  </a>
);

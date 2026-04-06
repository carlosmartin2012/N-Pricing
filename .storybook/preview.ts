import '../index.css';
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#0e0e0e' },
        light: { name: 'Light', value: '#ffffff' },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
};

export default preview;

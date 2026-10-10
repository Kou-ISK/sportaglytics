import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // App distribution inventories exclude Storybook's development-only bundle.
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    plugins: viteConfig.plugins?.filter(
      (plugin) =>
        !(
          plugin &&
          typeof plugin === 'object' &&
          'name' in plugin &&
          plugin.name === 'sportaglytics-license-inventory'
        ),
    ),
  }),
  docs: {
    autodocs: 'tag',
  },
};

export default config;

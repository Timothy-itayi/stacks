/** @type { import('@storybook/sveltekit').StorybookConfig } */
const config = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|ts|svelte)"
  ],
  "addons": [
    "@storybook/addon-svelte-csf",
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest"
  ],
  "framework": {
    "name": "@storybook/sveltekit",
    "options": {}
  },
  "staticDirs": ['../static'],
  "webpackFinal": async (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      type: 'asset'
    });
    return config;
  }
};
export default config;
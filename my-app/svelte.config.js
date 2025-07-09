import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      runtime: 'nodejs18.x',
      split: false
    }),
    alias: {
      $lib: './src/lib'
    }
  }
};

export default config;

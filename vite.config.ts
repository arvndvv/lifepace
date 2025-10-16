import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// If you deploy to GitHub Pages project site, set this to your repository name.
// Otherwise leave it empty so the app serves from the root path.
const repo = process.env.VITE_PUBLISH_BASE ?? '';

const normaliseBase = (value: string): string => {
  if (!value) {
    return '';
  }
  return value.replace(/^\/+|\/+$/g, '');
};

export default defineConfig(({ command }) => {
  const basePath = normaliseBase(repo);
  const resolvedBase = basePath ? `/${basePath}/` : '/';

  return {
    base: command === 'build' ? resolvedBase : '/',
    plugins: [react()],
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
    },
    server: { host: true }
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// When deploying to GitHub Pages under a project site (e.g. github.com/<user>/lifepace),
// assets need to resolve from "/lifepace/". Default to that repo name, but allow overriding
// via VITE_PUBLISH_BASE so other environments can set their own base path.
const repo = 'driftcue-webapp';

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

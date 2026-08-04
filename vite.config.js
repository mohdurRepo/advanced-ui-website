import { defineConfig } from 'vite';

export default defineConfig({
  // Ensures standard relative asset links across the project
  base: './', 
  build: {
    rollupOptions: {
      output: {
        // Keeps your CSS, JS, and image folder structures clean
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || '';
          if (/\.css$/i.test(name)) {
            return 'assets/css/[name].[ext]';
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
            return 'assets/images/[name].[ext]';
          }
          return 'assets/[name].[ext]';
        },
        chunkFileNames: 'assets/js/[name].js',
        entryFileNames: 'assets/js/[name].js',
      },
    },
  },
  experimental: {
    // This intercepts asset URLs inside compiled CSS files
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'css') {
        // If the path contains 'assets/images/', strip 'assets/' out
        // This converts '../../assets/images/file.png' into '../images/file.png'
        return `../${filename.replace('assets/', '')}`;
      }
      return filename;
    }
  }
});
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import cofounderVitePlugin from "./src/_cofounder/vite-plugin/index";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		// webcontainers stuff
		{
			name: "isolation",
			configureServer(server) {
				server.middlewares.use((_req, res, next) => {
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
					next();
				});
			},
		},
		// pre transform ; to replace/inject <GenUi*> to allow editing ui - COMMENTED OUT
		/*
		{
			name: "cofounderVitePluginPre",
			async transform(code, id) {
				return await cofounderVitePlugin.pre({
					code,
					path: id,
				});
			},
			enforce: "pre", // ensure this plugin runs before other transformations
		},
		*/

		react(),
	],
	server: {
		host: true,
		allowedHosts: ['.launchpulse.ai', '.trycloudflare.com', 'localhost', '123ad-performance.launchpulse.ai'],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@schema": path.resolve(__dirname, "../backend/schema.ts"),
		},
	},
	build: {
		outDir: "dist",
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['react', 'react-dom'],
					ui: ['@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar', '@radix-ui/react-button', '@radix-ui/react-card', '@radix-ui/react-checkbox', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-form', '@radix-ui/react-input', '@radix-ui/react-label', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-sheet', '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-textarea', '@radix-ui/react-toast', '@radix-ui/react-tooltip'],
					router: ['react-router-dom'],
					query: ['@tanstack/react-query'],
					redux: ['@reduxjs/toolkit', 'react-redux', 'redux', 'redux-persist', 'redux-thunk'],
					charts: ['recharts'],
					icons: ['lucide-react', '@heroicons/react'],
					utils: ['axios', 'clsx', 'tailwind-merge', 'date-fns', 'zod']
				}
			}
		},
		chunkSizeWarningLimit: 1000
	},
});

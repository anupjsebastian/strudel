/**
 * File loaders for different environments
 */

/**
 * Node.js file loader using fs/promises
 * @param {string} basePath - Base directory for resolving relative imports
 * @returns {Function} async file loader function
 */
export function createNodeFileLoader(basePath = process.cwd()) {
    return async (importPath) => {
        const { readFile } = await import('fs/promises');
        const { resolve, dirname } = await import('path');
        const { fileURLToPath } = await import('url');

        // Handle relative paths
        let fullPath = importPath;
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            fullPath = resolve(basePath, importPath);
        }

        // Add .str extension if not present
        if (!fullPath.endsWith('.str')) {
            fullPath += '.str';
        }

        const content = await readFile(fullPath, 'utf-8');
        return content;
    };
}

/**
 * Browser file loader using fetch
 * @param {string} baseURL - Base URL for resolving relative imports
 * @returns {Function} async file loader function
 */
export function createBrowserFileLoader(baseURL = window.location.href) {
    return async (importPath) => {
        // Handle relative paths
        let fullURL = importPath;
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const base = new URL(baseURL);
            fullURL = new URL(importPath, base.href).href;
        }

        // Add .str extension if not present
        if (!fullURL.endsWith('.str')) {
            fullURL += '.str';
        }

        const response = await fetch(fullURL);
        if (!response.ok) {
            throw new Error(`Failed to load module: ${fullURL} (${response.status})`);
        }

        return await response.text();
    };
}

/**
 * Custom file loader from a map/object
 * Useful for testing or when files are already in memory
 * @param {Object} files - Object mapping file paths to content
 * @returns {Function} async file loader function
 */
export function createMemoryFileLoader(files = {}) {
    return async (importPath) => {
        // Normalize path
        let normalizedPath = importPath;
        if (!normalizedPath.endsWith('.str')) {
            normalizedPath += '.str';
        }

        if (!(normalizedPath in files)) {
            throw new Error(`Module not found: ${importPath}`);
        }

        return files[normalizedPath];
    };
}

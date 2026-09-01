const fs = require('fs');
const path = require('path');

function checkFile(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== 'build') {
                checkFile(fullPath);
            }
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    let resolvedPath = path.resolve(dir, importPath);
                    // Check exact case
                    let found = false;
                    const extensions = ['', '.js', '.jsx', '.json', '/index.js', '/index.jsx'];
                    for (const ext of extensions) {
                        const p = resolvedPath + ext;
                        if (fs.existsSync(p)) {
                            const dirname = path.dirname(p);
                            const basename = path.basename(p);
                            const actualFiles = fs.readdirSync(dirname);
                            if (!actualFiles.includes(basename)) {
                                console.log(`[CASE ERROR] In ${fullPath}: import '${importPath}' resolves to ${basename} but actual casing is different.`);
                            }
                            found = true;
                            break;
                        }
                    }
                }
            }
        }
    }
}

console.log("Checking Admin Portal...");
checkFile('./Admin Portal/src');
console.log("Checking Student portal...");
checkFile('./Student portal/src');
console.log("Checking Teacher Portal...");
checkFile('./Teacher Portal/src');
console.log("Done.");

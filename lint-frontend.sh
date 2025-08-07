#!/bin/bash

# Frontend Linting Script for Claude Code
# This script sets up and runs linting on your frontend code

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Frontend Linting Script${NC}"
echo "==============================="

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: 'frontend' directory not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for Node.js and npm
if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js version:${NC} $(node --version)"
echo -e "${GREEN}✓ npm version:${NC} $(npm --version)"

# Initialize package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}📦 Initializing package.json...${NC}"
    npm init -y > /dev/null 2>&1
fi

# Install linting dependencies
echo -e "${YELLOW}📦 Installing linting dependencies...${NC}"
npm install --save-dev \
    eslint@8 \
    eslint-plugin-react@7 \
    eslint-plugin-react-hooks@4 \
    htmlhint@1 \
    prettier@3 \
    eslint-config-prettier@9 \
    eslint-plugin-prettier@5 \
    --silent

# Create ESLint configuration if it doesn't exist
if [ ! -f ".eslintrc.json" ]; then
    echo -e "${YELLOW}📝 Creating ESLint configuration...${NC}"
    cat > .eslintrc.json << 'EOF'
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": false
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:prettier/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "script",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["react", "react-hooks", "prettier"],
  "settings": {
    "react": {
      "version": "18.0"
    }
  },
  "globals": {
    "React": "readonly",
    "ReactDOM": "readonly",
    "tailwind": "readonly"
  },
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "warn",
    "react/jsx-no-undef": "error",
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prettier/prettier": ["error", {
      "singleQuote": false,
      "trailingComma": "es5",
      "bracketSpacing": true,
      "printWidth": 100,
      "tabWidth": 2,
      "semi": true
    }]
  },
  "ignorePatterns": ["*.html", "node_modules/", "build/", "dist/"]
}
EOF
fi

# Create HTMLHint configuration if it doesn't exist
if [ ! -f ".htmlhintrc" ]; then
    echo -e "${YELLOW}📝 Creating HTMLHint configuration...${NC}"
    cat > .htmlhintrc << 'EOF'
{
  "tagname-lowercase": true,
  "attr-lowercase": true,
  "attr-value-double-quotes": true,
  "attr-value-not-empty": false,
  "attr-no-duplication": true,
  "doctype-first": true,
  "tag-pair": true,
  "empty-tag-not-self-closed": true,
  "spec-char-escape": true,
  "id-unique": true,
  "src-not-empty": true,
  "title-require": true,
  "alt-require": false,
  "doctype-html5": true,
  "space-tab-mixed-disabled": "space",
  "id-class-ad-disabled": false,
  "attr-unsafe-chars": true,
  "head-script-disabled": false,
  "inline-style-disabled": false,
  "inline-script-disabled": false
}
EOF
fi

# Create .prettierrc if it doesn't exist
if [ ! -f ".prettierrc" ]; then
    echo -e "${YELLOW}📝 Creating Prettier configuration...${NC}"
    cat > .prettierrc << 'EOF'
{
  "singleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "endOfLine": "lf",
  "arrowParens": "always",
  "htmlWhitespaceSensitivity": "css",
  "proseWrap": "preserve"
}
EOF
fi

# Create .prettierignore if it doesn't exist
if [ ! -f ".prettierignore" ]; then
    echo -e "${YELLOW}📝 Creating Prettier ignore file...${NC}"
    cat > .prettierignore << 'EOF'
node_modules/
*.min.js
*.min.css
dist/
build/
coverage/
*.log
.git/
*.pyc
__pycache__/
venv/
myenve/
staticfiles/
*.sqlite3
EOF
fi

# Create .eslintignore if it doesn't exist
if [ ! -f ".eslintignore" ]; then
    echo -e "${YELLOW}📝 Creating ESLint ignore file...${NC}"
    cat > .eslintignore << 'EOF'
node_modules/
*.min.js
dist/
build/
coverage/
*.log
backend/
staticfiles/
EOF
fi

echo -e "${GREEN}✓ Configuration files created/verified${NC}"
echo ""
echo -e "${YELLOW}🔍 Running linters...${NC}"
echo "==============================="

# Track if any errors were found
ERRORS_FOUND=0

# Run HTMLHint on HTML files
echo -e "${YELLOW}📄 Checking HTML files...${NC}"
HTML_FILES=$(find frontend -name "*.html" -type f 2>/dev/null | head -1)
if [ -n "$HTML_FILES" ]; then
    npx htmlhint "frontend/**/*.html" || ERRORS_FOUND=1
else
    echo "No HTML files found to lint"
fi

echo ""

# Extract JavaScript from HTML files for linting
echo -e "${YELLOW}📜 Extracting and checking JavaScript from HTML files...${NC}"
TEMP_JS_DIR="temp_js_lint"
mkdir -p "$TEMP_JS_DIR"

# Extract script content from HTML files (handling spaces in filenames)
find frontend -name "*.html" -type f -print0 | while IFS= read -r -d '' html_file; do
    # Extract inline scripts and save to temp files
    base_name=$(basename "$html_file" .html)
    dir_name=$(dirname "$html_file")
    relative_dir=${dir_name#frontend/}
    
    # Create matching directory structure in temp
    mkdir -p "$TEMP_JS_DIR/$relative_dir"
    
    # Extract script tags with type="text/babel" or no type
    awk '/<script[^>]*type="text\/babel"[^>]*>/,/<\/script>/ {
        if (/<script[^>]*type="text\/babel"[^>]*>/) {
            in_script=1
            next
        }
        if (/<\/script>/) {
            in_script=0
            next
        }
        if (in_script) print
    }' "$html_file" > "$TEMP_JS_DIR/$relative_dir/${base_name}_inline.js"
    
    # Only keep file if it has content
    if [ ! -s "$TEMP_JS_DIR/$relative_dir/${base_name}_inline.js" ]; then
        rm "$TEMP_JS_DIR/$relative_dir/${base_name}_inline.js"
    fi
done

# Lint extracted JavaScript
JS_FILES=$(find "$TEMP_JS_DIR" -name "*.js" -type f 2>/dev/null | head -1)
if [ -n "$JS_FILES" ]; then
    npx eslint "$TEMP_JS_DIR/**/*.js" --fix || ERRORS_FOUND=1
else
    echo "No inline JavaScript found in HTML files"
fi

# Clean up temp directory
rm -rf "$TEMP_JS_DIR"

echo ""

# Run ESLint on standalone JavaScript files
echo -e "${YELLOW}🔧 Checking standalone JavaScript files...${NC}"
JS_FILES=$(find frontend -name "*.js" -type f 2>/dev/null | head -1)
if [ -n "$JS_FILES" ]; then
    npx eslint "frontend/**/*.js" --fix || ERRORS_FOUND=1
else
    echo "No standalone JavaScript files found to lint"
fi

echo ""

# Run Prettier to check formatting
echo -e "${YELLOW}💅 Checking code formatting with Prettier...${NC}"
npx prettier --check "frontend/**/*.{html,js,css}" || {
    echo -e "${YELLOW}💡 Tip: Run 'npm run format' to automatically fix formatting issues${NC}"
    ERRORS_FOUND=1
}

echo ""
echo "==============================="

# Add npm scripts to package.json
echo -e "${YELLOW}📦 Adding npm scripts to package.json...${NC}"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts.lint = 'bash lint-frontend.sh';
pkg.scripts['lint:html'] = 'htmlhint \"frontend/**/*.html\"';
pkg.scripts['lint:js'] = 'eslint \"frontend/**/*.js\"';
pkg.scripts['lint:fix'] = 'eslint \"frontend/**/*.js\" --fix';
pkg.scripts.format = 'prettier --write \"frontend/**/*.{html,js,css}\"';
pkg.scripts['format:check'] = 'prettier --check \"frontend/**/*.{html,js,css}\"';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Summary
if [ $ERRORS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All linting checks passed!${NC}"
else
    echo -e "${RED}❌ Linting errors found. Please fix them before committing.${NC}"
    echo ""
    echo -e "${YELLOW}Available commands:${NC}"
    echo "  npm run lint       - Run all linters"
    echo "  npm run lint:html  - Lint HTML files only"
    echo "  npm run lint:js    - Lint JavaScript files only"
    echo "  npm run lint:fix   - Auto-fix JavaScript issues"
    echo "  npm run format     - Auto-format all files"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Linting setup complete!${NC}"
echo ""
echo -e "${YELLOW}You can now use these commands:${NC}"
echo "  npm run lint       - Run all linters"
echo "  npm run lint:html  - Lint HTML files only"
echo "  npm run lint:js    - Lint JavaScript files only" 
echo "  npm run lint:fix   - Auto-fix JavaScript issues"
echo "  npm run format     - Auto-format all files"
echo "  npm run format:check - Check formatting without changing files"
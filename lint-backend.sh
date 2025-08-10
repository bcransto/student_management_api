#!/bin/bash

# Backend (Django/Python) Linting Script
# This script runs linting on your Django backend code

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐍 Backend Python/Django Linting Script${NC}"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo -e "${RED}❌ Error: 'manage.py' not found!${NC}"
    echo "Please run this script from the Django project root directory."
    exit 1
fi

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not activated${NC}"
    echo "Attempting to activate myenv..."
    if [ -d "myenv" ]; then
        source myenv/bin/activate
        echo -e "${GREEN}✓ Virtual environment activated${NC}"
    else
        echo -e "${RED}❌ Virtual environment 'myenv' not found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Using Python:${NC} $(which python)"
echo -e "${GREEN}✓ Python version:${NC} $(python --version)"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Python linting tools if not present
echo -e "${YELLOW}📦 Checking Python linting tools...${NC}"

TOOLS_TO_INSTALL=""

if ! command_exists black; then
    TOOLS_TO_INSTALL="$TOOLS_TO_INSTALL black"
fi

if ! command_exists flake8; then
    TOOLS_TO_INSTALL="$TOOLS_TO_INSTALL flake8"
fi

if ! command_exists isort; then
    TOOLS_TO_INSTALL="$TOOLS_TO_INSTALL isort"
fi

if [ -n "$TOOLS_TO_INSTALL" ]; then
    echo -e "${YELLOW}Installing missing tools: $TOOLS_TO_INSTALL${NC}"
    pip install $TOOLS_TO_INSTALL
fi

echo -e "${GREEN}✓ All linting tools available${NC}"

# Create .flake8 configuration if it doesn't exist
if [ ! -f ".flake8" ]; then
    echo -e "${YELLOW}📝 Creating Flake8 configuration...${NC}"
    cat > .flake8 << 'EOF'
[flake8]
# Django-friendly flake8 configuration
max-line-length = 120
exclude = 
    .git,
    __pycache__,
    migrations,
    myenv,
    venv,
    .venv,
    staticfiles,
    node_modules,
    build,
    dist,
    *.egg-info,
    .pytest_cache,
    htmlcov,
    .coverage
ignore = 
    # Django recommends these ignores
    E203,  # whitespace before ':'
    E501,  # line too long (handled by max-line-length)
    W503,  # line break before binary operator
    W504,  # line break after binary operator
    E231,  # missing whitespace after ','
# Per-file ignores
per-file-ignores =
    # Allow imports at bottom of settings files
    */settings.py:E402
    */settings/*.py:E402
    # Allow long lines in migrations
    */migrations/*.py:E501
EOF
fi

# Create pyproject.toml for Black and isort if it doesn't exist
if [ ! -f "pyproject.toml" ]; then
    echo -e "${YELLOW}📝 Creating pyproject.toml configuration...${NC}"
    cat > pyproject.toml << 'EOF'
[tool.black]
line-length = 120
target-version = ['py38', 'py39', 'py310', 'py311', 'py312']
include = '\.pyi?$'
exclude = '''
/(
    \.git
  | \.hg
  | \.mypy_cache
  | \.tox
  | \.venv
  | myenv
  | _build
  | buck-out
  | build
  | dist
  | migrations
  | node_modules
  | staticfiles
)/
'''

[tool.isort]
profile = "black"
line_length = 120
skip = ["migrations", "myenv", "venv", ".venv", "node_modules"]
skip_glob = ["*/migrations/*"]
multi_line_output = 3
include_trailing_comma = true
force_grid_wrap = 0
use_parentheses = true
ensure_newline_before_comments = true
split_on_trailing_comma = true
EOF
fi

echo -e "${GREEN}✓ Configuration files created/verified${NC}"
echo ""
echo -e "${YELLOW}🔍 Running linters...${NC}"
echo "========================================"

# Track if any errors were found
ERRORS_FOUND=0

# Define Python directories to check
PYTHON_DIRS="students student_project"
PYTHON_FILES="manage.py"

# Run isort (import sorting) - check only
echo -e "${BLUE}📚 Checking import sorting with isort...${NC}"
if isort --check-only --diff $PYTHON_DIRS $PYTHON_FILES 2>/dev/null; then
    echo -e "${GREEN}✓ Imports are properly sorted${NC}"
else
    echo -e "${YELLOW}⚠️  Some imports need sorting${NC}"
    echo -e "${YELLOW}   Run: isort $PYTHON_DIRS $PYTHON_FILES${NC}"
    ERRORS_FOUND=1
fi

echo ""

# Run Black (code formatting) - check only
echo -e "${BLUE}🎨 Checking code formatting with Black...${NC}"
if black --check $PYTHON_DIRS $PYTHON_FILES 2>/dev/null; then
    echo -e "${GREEN}✓ Code is properly formatted${NC}"
else
    echo -e "${YELLOW}⚠️  Some files need formatting${NC}"
    echo -e "${YELLOW}   Run: black $PYTHON_DIRS $PYTHON_FILES${NC}"
    ERRORS_FOUND=1
fi

echo ""

# Run Flake8 (style guide enforcement)
echo -e "${BLUE}🔎 Checking code style with Flake8...${NC}"
if flake8 $PYTHON_DIRS $PYTHON_FILES; then
    echo -e "${GREEN}✓ No style issues found${NC}"
else
    echo -e "${YELLOW}⚠️  Style issues found${NC}"
    ERRORS_FOUND=1
fi

echo ""

# Django-specific checks
echo -e "${BLUE}🎯 Running Django checks...${NC}"
if python manage.py check --deploy --fail-level WARNING 2>/dev/null; then
    echo -e "${GREEN}✓ Django checks passed${NC}"
else
    echo -e "${YELLOW}⚠️  Django check warnings${NC}"
    # Don't fail on Django warnings
fi

echo ""

# Check for Python security issues
echo -e "${BLUE}🔒 Checking for common security issues...${NC}"

# Check for DEBUG = True in production settings
if grep -r "DEBUG\s*=\s*True" --include="*.py" student_project/settings.py 2>/dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: DEBUG = True found in settings${NC}"
fi

# Check for hardcoded secrets
if grep -rE "(SECRET_KEY|PASSWORD|API_KEY)\s*=\s*['\"][^'\"]+['\"]" --include="*.py" $PYTHON_DIRS 2>/dev/null | grep -v "settings.py" | grep -v "example" | grep -v "test"; then
    echo -e "${YELLOW}⚠️  WARNING: Possible hardcoded secrets found${NC}"
else
    echo -e "${GREEN}✓ No obvious hardcoded secrets${NC}"
fi

echo ""
echo "========================================"

# Create convenience scripts in package.json
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 Adding Python linting scripts to package.json...${NC}"
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts['lint:python'] = 'bash lint-backend.sh';
    pkg.scripts['format:python'] = 'black students student_project manage.py && isort students student_project manage.py';
    pkg.scripts['lint:all'] = 'npm run lint && npm run lint:python';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    echo -e "${GREEN}✓ npm scripts added${NC}"
fi

# Summary
if [ $ERRORS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All backend linting checks passed!${NC}"
else
    echo -e "${RED}❌ Some linting issues found. Please fix them before committing.${NC}"
    echo ""
    echo -e "${YELLOW}Quick fix commands:${NC}"
    echo "  Format code:  ${BLUE}black students student_project manage.py${NC}"
    echo "  Sort imports: ${BLUE}isort students student_project manage.py${NC}"
    echo "  Or use npm:   ${BLUE}npm run format:python${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Backend linting complete!${NC}"
echo ""
echo -e "${YELLOW}Available commands:${NC}"
echo "  npm run lint:python    - Run Python linters (this script)"
echo "  npm run format:python  - Auto-format Python code"
echo "  npm run lint:all       - Run both frontend and backend linters"
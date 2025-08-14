#!/bin/bash
# Fix Django installation on PythonAnywhere

echo "Fixing Django installation on PythonAnywhere..."

# Activate virtual environment
source ~/student_management_api/venv/bin/activate

# Uninstall Django to fix any corruption
pip uninstall django djangorestframework djangorestframework-simplejwt -y

# Reinstall all packages from requirements.txt with exact versions
pip install --upgrade pip
pip install -r requirements.txt

echo "Django reinstalled. Testing import..."
python -c "from django.db.migrations import migration; print('Django migrations module OK')"

echo "Installation complete. Try makemigrations again."
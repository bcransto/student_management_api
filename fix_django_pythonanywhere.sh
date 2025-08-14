#!/bin/bash
# Fix Django installation on PythonAnywhere

echo "Fixing Django installation on PythonAnywhere..."

# Activate virtual environment
source ~/student_management_api/myenv/bin/activate

# Uninstall and reinstall Django and core dependencies
pip uninstall django -y
pip uninstall django-rest-framework -y
pip uninstall djangorestframework-simplejwt -y

# Reinstall with specific versions
pip install Django==5.1.2
pip install djangorestframework==3.15.2
pip install djangorestframework-simplejwt==5.3.1
pip install django-cors-headers==4.4.0
pip install django-filter==24.3
pip install python-dotenv==1.0.1
pip install mysqlclient==2.2.4
pip install whitenoise==6.7.0

echo "Django reinstalled. Testing import..."
python -c "from django.db.migrations import migration; print('Django migrations module OK')"

echo "Installation complete. Try makemigrations again."
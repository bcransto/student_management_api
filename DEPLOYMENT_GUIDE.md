# Fresh Deployment Guide for PythonAnywhere

## Step 1: Pull Latest Code
```bash
cd ~/student_management_api
git pull origin main
```

## Step 2: Reset MySQL Database

### Option A: Drop and Recreate (Cleanest)
```bash
# Open MySQL console on PythonAnywhere
mysql -u bcranston -p 'bcranston$studentdb' -h bcranston.mysql.pythonanywhere-services.com

# In MySQL console:
DROP DATABASE `bcranston$studentdb`;
CREATE DATABASE `bcranston$studentdb` CHARACTER SET utf8;
EXIT;
```

### Option B: Delete All Tables
```bash
# Or use Django to drop all tables
python manage.py shell
```
```python
from django.db import connection
cursor = connection.cursor()
cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
cursor.execute("SHOW TABLES;")
tables = cursor.fetchall()
for table in tables:
    cursor.execute(f"DROP TABLE {table[0]};")
cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
exit()
```

## Step 3: Run Fresh Migrations
```bash
# Remove old migration files (optional but recommended for clean start)
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Create fresh migrations
python manage.py makemigrations

# Apply migrations to create all tables
python manage.py migrate
```

## Step 4: Create Superuser
```bash
python manage.py createsuperuser
# Email: bcranston@carlisle.k12.ma.us
# Password: (choose a secure password)
```

## Step 5: Set Up Email Configuration

### Create .env file on PythonAnywhere:
```bash
cd ~/student_management_api
nano .env
```

### Add these settings (for Gmail):
```env
# Gmail settings
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@carlisle.k12.ma.us
EMAIL_HOST_PASSWORD=your-app-specific-password
DEFAULT_FROM_EMAIL=noreply@carlisle.k12.ma.us

# To get Gmail app password:
# 1. Go to https://myaccount.google.com/security
# 2. Enable 2-factor authentication
# 3. Go to https://myaccount.google.com/apppasswords
# 4. Create app password for "Mail"
```

### Alternative: SendGrid (often more reliable)
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=noreply@carlisle.k12.ma.us
```

## Step 6: Load Sample Data (Optional)
```bash
# Create a data loading script
python manage.py shell
```
```python
from students.models import User, Student, Class
from datetime import date

# Create sample teachers
teacher1 = User.objects.create_user(
    username='teacher1',
    email='teacher1@carlisle.k12.ma.us',
    password='ChangeMe123!',
    first_name='John',
    last_name='Smith',
    is_teacher=True
)

# Create sample classes
math_class = Class.objects.create(
    name='Math 101',
    subject='Mathematics',
    grade_level=9,
    teacher=teacher1,
    description='Algebra 1'
)

# Create sample students
for i in range(1, 4):
    Student.objects.create(
        student_id=f'2024{i:04d}',
        first_name=f'Student{i}',
        last_name=f'Test{i}',
        email=f'student{i}@school.edu',
        gender='male' if i % 2 else 'female'
    )

print("Sample data created!")
```

## Step 7: Test Email Functionality
```bash
python manage.py shell
```
```python
from django.core.mail import send_mail
from django.conf import settings

send_mail(
    'Test Email',
    'This is a test email from PythonAnywhere.',
    settings.DEFAULT_FROM_EMAIL,
    ['your-email@example.com'],
    fail_silently=False,
)
print("Email sent! Check your inbox.")
```

## Step 8: Reload Web App
1. Go to PythonAnywhere dashboard
2. Click on "Web" tab
3. Click "Reload" button

## Step 9: Verify Deployment
1. Visit https://bcranston.pythonanywhere.com
2. Log in with superuser credentials
3. Test creating a user (should send welcome email)
4. Test password reset functionality

## Troubleshooting

### If emails don't work:
1. Check PythonAnywhere error log (Web tab → Error log)
2. Verify .env file is loaded correctly
3. For Gmail: Make sure 2FA is enabled and using app password
4. Try SendGrid as alternative

### If migrations fail:
```bash
# Reset migrations completely
python manage.py migrate --fake-zero
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
python manage.py makemigrations
python manage.py migrate --fake-initial
```

### If static files don't load:
```bash
python manage.py collectstatic --noinput
```

## Security Checklist
- [ ] Changed DEBUG to False in production
- [ ] Set strong SECRET_KEY in .env
- [ ] Created strong superuser password
- [ ] Email credentials in .env (not in code)
- [ ] Verified ALLOWED_HOSTS includes your domain

## Post-Deployment
1. Create teacher accounts for staff
2. Import student data
3. Set up classroom layouts
4. Configure seating arrangements
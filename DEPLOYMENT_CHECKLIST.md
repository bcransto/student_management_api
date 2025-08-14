# PythonAnywhere Deployment Checklist

## Pre-Deployment Status
- ✅ User management system implemented (Phase 1-4)
- ✅ Token expiration fixed (8 hours access, 30 days refresh)
- ✅ Test files added to .gitignore
- ✅ Email configuration prepared
- ✅ Deployment guide created

## Deployment Steps

### 1. Push Latest Changes to GitHub
```bash
git status
git add -A
git commit -m "Ready for PythonAnywhere deployment with user management"
git push origin main
```

### 2. On PythonAnywhere Console
```bash
cd ~/student_management_api
git pull origin main
```

### 3. Database Reset (Clean Start)
```bash
# Option A: Drop and recreate database
mysql -u bcranston -p 'bcranston$studentdb' -h bcranston.mysql.pythonanywhere-services.com

# In MySQL:
DROP DATABASE IF EXISTS `bcranston$studentdb`;
CREATE DATABASE `bcranston$studentdb` CHARACTER SET utf8;
EXIT;
```

### 4. Run Migrations
```bash
# Clean migration files (optional for fresh start)
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Create and apply migrations
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser
```bash
python manage.py createsuperuser
# Use your school email: bcranston@carlisle.k12.ma.us
```

### 6. Configure Email
Create `.env` file on PythonAnywhere:
```bash
nano .env
```

Add (for Gmail):
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@carlisle.k12.ma.us
EMAIL_HOST_PASSWORD=your-app-specific-password
DEFAULT_FROM_EMAIL=noreply@carlisle.k12.ma.us
```

### 7. Set Production Environment Variables
```bash
# Also add to .env:
DJANGO_ENV=production
SECRET_KEY=your-secure-secret-key-here
DB_NAME=bcranston$studentdb
DB_USER=bcranston
DB_PASSWORD=your-mysql-password
DB_HOST=bcranston.mysql.pythonanywhere-services.com
```

### 8. Collect Static Files
```bash
python manage.py collectstatic --noinput
```

### 9. Test Email
```bash
python manage.py shell
```
```python
from django.core.mail import send_mail
from django.conf import settings

send_mail(
    'Deployment Test',
    'Student Management System deployed successfully!',
    settings.DEFAULT_FROM_EMAIL,
    ['bcranston@carlisle.k12.ma.us'],
    fail_silently=False,
)
```

### 10. Reload Web App
- Go to PythonAnywhere dashboard
- Click "Web" tab
- Click "Reload" button

## Post-Deployment Verification

### Test Core Features
- [ ] Login with superuser account
- [ ] Access Users menu (superuser only)
- [ ] Create a new user (check email for temp password)
- [ ] Edit user profile
- [ ] Change password
- [ ] Test password reset flow

### Test Existing Features
- [ ] Student management (CRUD)
- [ ] Seating chart editor
- [ ] Class roster management
- [ ] Layout templates

### Monitor for Issues
- Check Error log in PythonAnywhere Web tab
- Verify tokens persist for 8 hours
- Confirm email notifications work

## Troubleshooting

### If migrations fail:
```bash
python manage.py migrate --fake-zero
python manage.py makemigrations
python manage.py migrate --fake-initial
```

### If emails don't send:
1. Check `.env` file loaded correctly
2. Verify Gmail app password (not regular password)
3. Check error logs for SMTP errors
4. Consider using SendGrid as alternative

### If static files missing:
```bash
python manage.py collectstatic --clear --noinput
```

## Important URLs
- Production: https://bcranston.pythonanywhere.com
- Admin: https://bcranston.pythonanywhere.com/admin/
- API: https://bcranston.pythonanywhere.com/api/

## Security Reminders
- ✅ DEBUG=False in production (auto-detected)
- ✅ Strong SECRET_KEY in .env
- ✅ HTTPS enforced (PythonAnywhere handles)
- ✅ Email credentials in .env (not in code)
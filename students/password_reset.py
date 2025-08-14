# students/password_reset.py
"""
Password reset functionality for the API
"""
import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import User


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """
    Request a password reset email
    """
    email = request.data.get('email')
    
    if not email:
        return Response(
            {'error': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        # Don't reveal whether a user exists
        return Response(
            {'message': 'If an account exists with this email, a password reset link has been sent.'},
            status=status.HTTP_200_OK
        )
    
    # Generate token
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    
    # Build reset URL (frontend will handle this)
    if settings.PRODUCTION:
        reset_url = f"https://bcranston.pythonanywhere.com/#password-reset/{uid}/{token}"
    else:
        reset_url = f"http://127.0.0.1:8000/#password-reset/{uid}/{token}"
    
    # Send email
    subject = 'Password Reset Request'
    message = f"""
    You requested a password reset for your account.
    
    Click the link below to reset your password:
    {reset_url}
    
    This link will expire in 1 hour.
    
    If you didn't request this reset, please ignore this email.
    """
    
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception as e:
        print(f"Email sending failed: {e}")
        # In development, print the reset URL to console
        if not settings.PRODUCTION:
            print(f"\n{'='*50}")
            print(f"Password Reset URL for {user.email}:")
            print(f"{reset_url}")
            print(f"{'='*50}\n")
    
    return Response(
        {'message': 'If an account exists with this email, a password reset link has been sent.'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """
    Confirm password reset with token
    """
    uid = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    if not all([uid, token, new_password]):
        return Response(
            {'error': 'uid, token, and new_password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate password
    if len(new_password) < 8:
        return Response(
            {'error': 'Password must be at least 8 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not any(char.isdigit() for char in new_password):
        return Response(
            {'error': 'Password must contain at least one number'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(char in special_chars for char in new_password):
        return Response(
            {'error': 'Password must contain at least one special character'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Decode uid
    try:
        uid = urlsafe_base64_decode(uid).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {'error': 'Invalid reset link'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check token
    if not default_token_generator.check_token(user, token):
        return Response(
            {'error': 'Invalid or expired reset link'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set new password
    user.set_password(new_password)
    user.save()
    
    # Send confirmation email
    try:
        send_mail(
            'Password Reset Successful',
            f'Your password has been successfully reset for {user.email}',
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
    except Exception:
        pass  # Don't fail if email doesn't send
    
    return Response(
        {'message': 'Password has been reset successfully'},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_validate(request):
    """
    Validate a password reset token without using it
    """
    uid = request.data.get('uid')
    token = request.data.get('token')
    
    if not all([uid, token]):
        return Response(
            {'valid': False, 'error': 'uid and token are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Decode uid
    try:
        uid = urlsafe_base64_decode(uid).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {'valid': False, 'error': 'Invalid reset link'},
            status=status.HTTP_200_OK
        )
    
    # Check token
    if not default_token_generator.check_token(user, token):
        return Response(
            {'valid': False, 'error': 'Invalid or expired reset link'},
            status=status.HTTP_200_OK
        )
    
    return Response(
        {'valid': True, 'email': user.email},
        status=status.HTTP_200_OK
    )
import functools
import datetime
import jwt
from flask import request, jsonify, g
from ..config import Config

def generate_token(user: dict) -> str:
    payload = {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'full_name': user['full_name'],
        'email': user['email'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        'iat': datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')

def authenticate(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required. Missing Bearer token.'}), 401
        
        token = auth_header.split(' ', 1)[1]
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            g.user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired.'}), 401
        except Exception:
            return jsonify({'error': 'Invalid or expired token.'}), 401

        return f(*args, **kwargs)
    return decorated

def authorize(allowed_roles: list):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(g, 'user') or not g.user:
                return jsonify({'error': 'Unauthorized.'}), 401
            if g.user.get('role') not in allowed_roles:
                return jsonify({
                    'error': f"Forbidden: role '{g.user.get('role')}' does not have permission to access this resource."
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


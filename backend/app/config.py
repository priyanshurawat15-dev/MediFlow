import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'mediflow_jwt_super_secret_key_2026')
    JWT_SECRET = os.environ.get('JWT_SECRET', 'mediflow_jwt_super_secret_key_2026')
    JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '24'))
    
    # SQLite Database File in root workspace directory
    DB_PATH = os.environ.get('DB_PATH', str(ROOT_DIR / 'mediflow.sqlite'))
    
    # Frontend build distribution directory for SPA serving
    FRONTEND_DIST = str(ROOT_DIR / 'frontend' / 'dist')
    
    PORT = int(os.environ.get('PORT', 5000))
    DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() in ('true', '1', 't')


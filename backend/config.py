import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    # Use DATABASE_URL from environment (set by Docker Compose), fallback to in-memory for serverless demo
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///:memory:')
    # Example for Docker Compose:
    # DATABASE_URL=postgresql://receiptvault:receiptvaultpass@db:5432/receiptvault
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # CORS settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    
    # OCR settings
    TESSERACT_PATH = os.getenv('TESSERACT_PATH', 'tesseract')
    GOOGLE_VISION_API_KEY = os.getenv('GOOGLE_VISION_API_KEY', '')
    
    # Upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}
    GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'receiptvault-images-210041012141')
    
    # UAE specific settings
    DEFAULT_CURRENCY = 'AED'
    VAT_RATE = 5.0  # UAE VAT rate
    
    # Authentication settings
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = 24 * 60 * 60  # 24 hours
    
    # Categories
    EXPENSE_CATEGORIES = [
        'Groceries',
        'Dining & Food',
        'Transport (Taxi/Metro)',
        'Fuel (Petrol)',
        'Utilities (DEWA/SEWA)',
        'Mobile & Telecom',
        'Healthcare (Pharmacy)',
        'Shopping & Fashion',
        'Electronics',
        'Entertainment',
        'Housing & Rent',
        'Education',
        'Government Fees',
        'Other'
    ]

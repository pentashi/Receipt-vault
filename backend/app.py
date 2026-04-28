from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
from sqlalchemy import text

from config import Config
from models import db
from routes.receipts import receipts_bp
from routes.expenses import expenses_bp
from routes.budgets import budgets_bp
from routes.auth import auth_bp

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)

# 16K Engineer Migration Helper: db.create_all() doesn't update existing tables.
# We must manually check for and add new columns to ensure the production DB matches our upgraded code.
def migrate_database():
    with app.app_context():
        try:
            # Final sweep for all tables to ensure schema matches model
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE"))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'AED'"))
            db.session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'en'"))
            
            # Receipts table
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'AED'"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10, 6) DEFAULT 1.0"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2)"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS address TEXT"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS transaction_trn VARCHAR(50)"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200)"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS refund_policy TEXT"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS barcode VARCHAR(50)"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS notes TEXT"))
            
            # Critical Fix: Convert JSON to JSONB for DISTINCT support
            try:
                db.session.execute(text("ALTER TABLE receipts ALTER COLUMN raw_extraction TYPE JSONB USING raw_extraction::jsonb"))
            except:
                db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS raw_extraction JSONB"))
                
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS time TIME"))
            db.session.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Other'"))
            
            # Budgets table
            db.session.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
            db.session.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC(5, 2) DEFAULT 80.0"))
            db.session.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS month INTEGER"))
            db.session.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS year INTEGER"))
            
            # Receipt Items table
            db.session.execute(text("ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS category VARCHAR(50)"))
            db.session.execute(text("ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1"))
            
            # Audit Logs table
            db.session.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"))
            try:
                db.session.execute(text("ALTER TABLE audit_logs ALTER COLUMN changes TYPE JSONB USING changes::jsonb"))
            except:
                db.session.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB"))
            
            # Ensure tables are created if missing
            db.create_all()
            db.session.commit()
            print("Database migration and table creation completed successfully.")
        except Exception as e:
            print(f"Migration error: {e}")
            db.session.rollback()
            # Try to continue despite migration errors
            try:
                db.create_all()
                db.session.commit()
            except: pass

# Run migration
migrate_database()

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
app.register_blueprint(receipts_bp, url_prefix='/api/v1/receipts')
app.register_blueprint(expenses_bp, url_prefix='/api/v1/expenses')
app.register_blueprint(budgets_bp, url_prefix='/api/v1/budgets')

# Apply CORS globally
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/')
def index():
    return jsonify({
        'message': 'ReceiptVault API',
        'version': '1.0.0',
        'status': 'running'
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'}), 200

# Catch-all route for frontend (SPA support)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return jsonify({
        'message': 'ReceiptVault API',
        'version': '1.0.0',
        'status': 'running'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

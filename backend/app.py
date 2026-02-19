from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os

from config import Config
from models import db
from routes.receipts import receipts_bp
from routes.expenses import expenses_bp
from routes.budgets import budgets_bp

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
db.init_app(app)


# Register blueprints
app.register_blueprint(receipts_bp, url_prefix='/api/v1/receipts')
app.register_blueprint(expenses_bp, url_prefix='/api/v1/expenses')
app.register_blueprint(budgets_bp, url_prefix='/api/v1/budgets')

# Apply CORS globally after blueprints
CORS(app, origins=app.config['CORS_ORIGINS'].split(','))

# Create database tables
with app.app_context():
    db.create_all()

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

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded receipt images"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

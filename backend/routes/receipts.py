from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import uuid

from models import db, Receipt, ReceiptItem
from services.ocr_service import OCRService
from config import Config

receipts_bp = Blueprint('receipts', __name__)

# Initialize OCR service
ocr_service = OCRService(Config.TESSERACT_PATH)

# Ensure upload folder exists
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)


def auto_categorize(store_name):
    """Automatically categorize receipt based on store name"""
    store_lower = store_name.lower()
    
    # Groceries/Supermarkets
    if any(word in store_lower for word in ['carrefour', 'lulu', 'hypermarket', 'supermarket', 'grocery', 'market']):
        return 'Groceries'
    
    # Transportation
    if any(word in store_lower for word in ['taxi', 'metro', 'rta', 'bus', 'transport', 'uber', 'careem']):
        return 'Transport'
    
    # Telecom/Mobile
    if any(word in store_lower for word in ['upay', 'etisalat', 'du', 'telecom', 'mobile', 'recharge', 'top-up', 'topup']):
        return 'Mobile & Telecom'
    
    # Dining
    if any(word in store_lower for word in ['restaurant', 'cafe', 'coffee', 'mcdonald', 'kfc', 'pizza', 'burger', 'dining']):
        return 'Dining & Food'
    
    # Fuel
    if any(word in store_lower for word in ['petrol', 'enoc', 'eppco', 'adnoc', 'fuel', 'gas']):
        return 'Fuel'
    
    # Healthcare
    if any(word in store_lower for word in ['pharmacy', 'hospital', 'clinic', 'medical', 'health']):
        return 'Healthcare'
    
    # Shopping
    if any(word in store_lower for word in ['mall', 'store', 'shop', 'boutique', 'fashion']):
        return 'Shopping'
    
    return 'Other'


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


@receipts_bp.route('/upload', methods=['POST'])
def upload_receipt():
    """Upload and process a receipt image"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, pdf'}), 400
        
        # Generate unique filename
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Process receipt with OCR
        receipt_data = ocr_service.parse_receipt(filepath)
        
        # Create receipt record
        store_name = receipt_data.get('store_name', 'Unknown')
        receipt = Receipt(
            receipt_id=str(uuid.uuid4()),
            store_name=store_name,
            date=receipt_data.get('date', datetime.now().date()),
            time=receipt_data.get('time'),
            total_excl_vat=receipt_data.get('total_excl_vat', 0),
            total_incl_vat=receipt_data.get('total_incl_vat', 0),
            vat_rate=receipt_data.get('vat_rate', Config.VAT_RATE),
            vat_amount=receipt_data.get('vat_amount', 0),
            payment_method=receipt_data.get('payment_method'),
            transaction_trn=receipt_data.get('transaction_trn'),
            image_path=filepath,
            category=auto_categorize(store_name).title()  # Normalize to title case
        )
        
        db.session.add(receipt)
        db.session.flush()  # Get receipt ID
        
        # Add items
        for item_data in receipt_data.get('items', []):
            item = ReceiptItem(
                receipt_id=receipt.id,
                item_name=item_data['item_name'],
                quantity=item_data.get('quantity', 1),
                price=item_data.get('price', 0)
            )
            db.session.add(item)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Receipt uploaded successfully',
            'receipt': receipt.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/', methods=['GET'])
def get_receipts():
    """Get all receipts with optional filters"""
    try:
        # Query parameters for filtering
        category = request.args.get('category')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        store_name = request.args.get('store_name')
        
        query = Receipt.query
        
        if category:
            query = query.filter(Receipt.category == category)
        
        if start_date:
            query = query.filter(Receipt.date >= datetime.fromisoformat(start_date).date())
        
        if end_date:
            query = query.filter(Receipt.date <= datetime.fromisoformat(end_date).date())
        
        if store_name:
            query = query.filter(Receipt.store_name.ilike(f'%{store_name}%'))
        
        receipts = query.order_by(Receipt.date.desc()).all()
        print(f"[DEBUG] /receipts/ endpoint: {len(receipts)} receipts found.")
        if receipts:
            print("[DEBUG] Receipt IDs:", [r.receipt_id for r in receipts])
        else:
            print("[DEBUG] No receipts returned by query.")
        return jsonify({
            'receipts': [receipt.to_dict() for receipt in receipts],
            'count': len(receipts)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>', methods=['GET'])
def get_receipt(receipt_id):
    """Get a specific receipt by ID"""
    try:
        receipt = Receipt.query.filter_by(receipt_id=receipt_id).first()
        
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        
        return jsonify(receipt.to_dict()), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>', methods=['PUT'])
def update_receipt(receipt_id):
    """Update receipt details"""
    try:
        receipt = Receipt.query.filter_by(receipt_id=receipt_id).first()
        
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'store_name' in data:
            receipt.store_name = data['store_name']
        if 'category' in data:
            receipt.category = data['category']
        if 'date' in data:
            receipt.date = datetime.fromisoformat(data['date']).date()
        if 'total_incl_vat' in data:
            receipt.total_incl_vat = float(data['total_incl_vat'])
        if 'vat_amount' in data:
            receipt.vat_amount = float(data['vat_amount'])
            # Recalculate VAT rate and excl VAT
            receipt.total_excl_vat = receipt.total_incl_vat - receipt.vat_amount
            if receipt.total_excl_vat > 0:
                receipt.vat_rate = (receipt.vat_amount / receipt.total_excl_vat) * 100
        if 'notes' in data:
            receipt.notes = data['notes']
        if 'payment_method' in data:
            receipt.payment_method = data['payment_method']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Receipt updated successfully',
            'receipt': receipt.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>', methods=['DELETE'])
def delete_receipt(receipt_id):
    """Delete a receipt"""
    try:
        receipt = Receipt.query.filter_by(receipt_id=receipt_id).first()
        
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        
        # Delete image file if exists
        if receipt.image_path and os.path.exists(receipt.image_path):
            os.remove(receipt.image_path)
        
        db.session.delete(receipt)
        db.session.commit()
        
        return jsonify({'message': 'Receipt deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

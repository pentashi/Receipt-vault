from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import uuid
from google.cloud import storage
import traceback

from models import db, Receipt, ReceiptItem, AuditLog
from services.ocr_service import OCRService
from services.fx_service import fx_service
from config import Config

receipts_bp = Blueprint('receipts', __name__)

# Initialize OCR service
ocr_service = OCRService()

# Initialize GCS client
try:
    storage_client = storage.Client()
except Exception as e:
    print(f"Failed to initialize GCS storage client: {str(e)}")
    storage_client = None

def upload_to_gcs(filepath, filename, original_content_type=None):
    """Upload file from local path to GCS and return the public URL"""
    if not storage_client:
        raise Exception("GCS storage client not available")
        
    bucket = storage_client.bucket(Config.GCS_BUCKET_NAME)
    blob = bucket.blob(f"receipts/{filename}")
    
    # Determine content type if not provided
    content_type = original_content_type
    if not content_type:
        ext = filename.rsplit('.', 1)[1].lower()
        if ext == 'pdf':
            content_type = 'application/pdf'
        elif ext in ['jpg', 'jpeg']:
            content_type = 'image/jpeg'
        elif ext == 'png':
            content_type = 'image/png'
            
    blob.upload_from_filename(filepath, content_type=content_type)
    return blob.public_url

def delete_from_gcs(public_url):
    """Delete file from GCS using its public URL"""
    try:
        if not storage_client or not public_url or Config.GCS_BUCKET_NAME not in public_url:
            return
            
        filename = public_url.split(f"{Config.GCS_BUCKET_NAME}/")[-1]
        bucket = storage_client.bucket(Config.GCS_BUCKET_NAME)
        blob = bucket.blob(filename)
        blob.delete()
    except Exception as e:
        print(f"Error deleting from GCS: {str(e)}")

def auto_categorize(store_name):
    """Automatically categorize receipt based on store name (UAE Optimized - Enterprise Grade)"""
    store_lower = store_name.lower()
    
    # Groceries & Hypermarkets
    if any(word in store_lower for word in [
        'carrefour', 'lulu', 'hypermarket', 'supermarket', 'grocery', 'market', 
        'spinneys', 'waitrose', 'choithrams', 'viva', 'union coop', 'shaklan', 
        'west zone', 'al maya', 'grand', 'baqer mohebi', 'emirates coop', 
        'abu dhabi coop', 'km trading', 'nesto', 'safestway', 'talabat mart', 'instashop'
    ]):
        return 'Groceries'
    
    # Dining & Food (Restaurants, Cafes, Delivery)
    if any(word in store_lower for word in [
        'restaurant', 'cafe', 'coffee', 'mcdonald', 'kfc', 'pizza', 'burger', 
        'dining', 'starbucks', 'costa', 'tim hortons', 'shawarma', 'cafeteria', 
        'bakery', 'subway', 'hardees', 'popeyes', 'jollibee', 'nandos', 'five guys',
        'shake shack', 'cheesecake factory', 'pf chang', 'paul', 'baskin robbins',
        'dunkin', 'krispy kreme', 'talabat', 'deliveroo', 'noon food', 'zomato'
    ]):
        return 'Dining & Food'

    # Transport & Logistics
    if any(word in store_lower for word in [
        'taxi', 'metro', 'rta', 'bus', 'transport', 'uber', 'careem', 'nol', 
        'salik', 'sharjah taxi', 'hala', 'ajman taxi', 'darb', 'm-parking', 
        'parking', 'valet', 'dhl', 'fedex', 'aramex', 'emirates post'
    ]):
        return 'Transport (Taxi/Metro)'
    
    # Fuel & Automotive
    if any(word in store_lower for word in [
        'petrol', 'enoc', 'eppco', 'adnoc', 'fuel', 'cafu', 'gas station', 
        'autopro', 'wheel alignment', 'car wash', 'tyre', 'garage', 'auto repair'
    ]):
        return 'Fuel (Petrol)'
    
    # Utilities & Home Services
    if any(word in store_lower for word in [
        'dewa', 'sewa', 'fewa', 'addc', 'aadc', 'empower', 'emcool', 'gas', 'water',
        'tabreed', 'cleaning', 'maid', 'laundry', 'dry clean', 'pest control', 'ac service'
    ]):
        return 'Utilities (DEWA/SEWA)'
        
    # Mobile & Telecom
    if any(word in store_lower for word in [
        'etisalat', 'du', 'virgin', 'upay', 'mobile', 'recharge', 'topup', 'telecom', 'e&'
    ]):
        return 'Mobile & Telecom'
    
    # Healthcare & Wellness
    if any(word in store_lower for word in [
        'pharmacy', 'hospital', 'clinic', 'medical', 'health', 'aster', 'life', 
        'boots', 'binsina', 'mediclinic', 'thumbay', 'cleveland', 'dentist', 'optician',
        'magrabi', 'fitness', 'gym', 'spa', 'salon', 'barber'
    ]):
        return 'Healthcare (Pharmacy)'
    
    # Shopping & Fashion
    if any(word in store_lower for word in [
        'mall', 'store', 'shop', 'boutique', 'fashion', 'zara', 'h&m', 'ikea', 
        'noon', 'amazon', 'brands', 'clothing', 'shoe', 'nike', 'adidas', 'centerpoint',
        'max fashion', 'splash', 'namshi', '6th street', 'sun & sand'
    ]):
        return 'Shopping & Fashion'
        
    # Electronics & Office
    if any(word in store_lower for word in [
        'sharaf', 'e-max', 'jumbo', 'electronics', 'apple', 'samsung', 
        'virgin megastore', 'noon electronics', 'computer', 'mobile shop', 'printer'
    ]):
        return 'Electronics'
    
    # Housing & Real Estate
    if any(word in store_lower for word in [
        'rent', 'real estate', 'property', 'wasl', 'emaar', 'damac', 'nakheel', 'ejari'
    ]):
        return 'Housing & Rent'

    # Government & Official
    if any(word in store_lower for word in [
        'dubai economy', 'mohre', 'ica', 'amer', 'tasheel', 'visa', 'typing', 
        'court', 'police', 'fine', 'municipality', 'customs', 'chamber of commerce'
    ]):
        return 'Government Fees'
    
    # Entertainment & Leisure
    if any(word in store_lower for word in [
        'cinema', 'vox', 'reel', 'novo', 'theme park', 'dubai parks', 'global village',
        'miracle garden', 'museum', 'expo', 'ticketing', 'entertainment', 'play'
    ]):
        return 'Entertainment'

    return 'Other'


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


@receipts_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_receipt():
    """Upload and process a receipt image"""
    user_id = get_jwt_identity()
    filepath = None
    try:
        print(f"DEBUG: Starting upload for user {user_id}")
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, pdf'}), 400
        
        # Save locally temporarily for OCR and GCS upload
        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        temp_dir = "/tmp/receiptvault_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        filepath = os.path.join(temp_dir, filename)
        content_type = file.content_type
        file.save(filepath)
        print(f"DEBUG: Saved temp file to {filepath}")
        
        # Process receipt with Document AI
        receipt_data = ocr_service.parse_receipt(filepath)
        print(f"DEBUG: OCR Extraction complete for {receipt_data.get('store_name')}")
        
        # 16K FX Intelligence: Convert to AED if necessary
        currency = receipt_data.get('currency', 'AED')
        original_amount = receipt_data.get('total_incl_vat', 0)
        total_aed, rate = fx_service.convert_to_aed(original_amount, currency)
        print(f"DEBUG: FX Conversion: {original_amount} {currency} -> {total_aed} AED (rate {rate})")
        
        # Upload to GCS from the saved file path
        public_url = upload_to_gcs(filepath, filename, content_type)
        print(f"DEBUG: Uploaded to GCS: {public_url}")
        
        # Create receipt record
        store_name = receipt_data.get('store_name', 'Unknown')
        category = auto_categorize(store_name)
        
        receipt = Receipt(
            user_id=user_id,
            receipt_id=str(uuid.uuid4()),
            store_name=store_name,
            address=receipt_data.get('address'),
            phone_number=receipt_data.get('phone_number'),
            date=receipt_data.get('date', datetime.now().date()),
            time=receipt_data.get('time'),
            currency=currency,
            exchange_rate=rate,
            original_amount=original_amount,
            total_excl_vat=total_aed - (receipt_data.get('vat_amount', 0) * rate),
            total_incl_vat=total_aed,
            vat_rate=receipt_data.get('vat_rate', Config.VAT_RATE),
            vat_amount=receipt_data.get('vat_amount', 0) * rate,
            payment_method=receipt_data.get('payment_method'),
            transaction_trn=receipt_data.get('transaction_trn'),
            image_path=public_url,
            category=category,
            raw_extraction=receipt_data.get('raw_extraction')
        )
        
        db.session.add(receipt)
        db.session.flush()
        print(f"DEBUG: Database Receipt created with ID {receipt.id}")
        
        # Immutable Audit Log
        audit = AuditLog(
            user_id=user_id,
            action='CREATE',
            resource_type='RECEIPT',
            resource_id=receipt.receipt_id,
            changes={'new': receipt.to_dict()},
            ip_address=request.remote_addr
        )
        db.session.add(audit)
        
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
        print(f"DEBUG: Transaction committed successfully")
        
        # Cleanup temp file
        if os.path.exists(filepath):
            os.remove(filepath)
            
        return jsonify({
            'message': 'Receipt uploaded successfully',
            'receipt': receipt.to_dict()
        }), 201
        
    except Exception as e:
        print(f"ERROR in upload_receipt: {str(e)}")
        import traceback
        traceback.print_exc()
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/manual', methods=['POST'])
@jwt_required()
def create_manual_receipt():
    """Create a manual receipt entry without an image"""
    user_id = get_jwt_identity()
    try:
        data = request.get_json()
        
        store_name = data.get('store_name', 'Manual Entry')
        total_incl_vat = float(data.get('total_incl_vat', 0))
        vat_amount = float(data.get('vat_amount', 0))
        category = data.get('category') or auto_categorize(store_name)
        date_str = data.get('date')
        
        receipt_date = datetime.fromisoformat(date_str).date() if date_str else datetime.now().date()
        
        receipt = Receipt(
            user_id=user_id,
            receipt_id=str(uuid.uuid4()),
            store_name=store_name,
            date=receipt_date,
            total_incl_vat=total_incl_vat,
            vat_amount=vat_amount,
            total_excl_vat=total_incl_vat - vat_amount,
            vat_rate=round((vat_amount / (total_incl_vat - vat_amount) * 100), 1) if (total_incl_vat - vat_amount) > 0 else 5.0,
            category=category,
            payment_method=data.get('payment_method', 'Cash'),
            notes=data.get('notes', 'Manual entry'),
            image_path=None
        )
        
        db.session.add(receipt)
        db.session.commit()
        
        return jsonify({
            'message': 'Manual entry created successfully',
            'receipt': receipt.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/', methods=['GET'])
@jwt_required()
def get_receipts():
    """Get all receipts with optional filters including item-level search"""
    user_id = get_jwt_identity()
    try:
        category = request.args.get('category')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        store_name = request.args.get('store_name')
        item_name = request.args.get('item_name')
        
        print(f"DEBUG: Fetching receipts for user {user_id} with filters: cat={category}, store={store_name}, item={item_name}")
        
        query = Receipt.query.filter_by(user_id=user_id)
        
        if category and category != 'all' and category != '':
            query = query.filter(Receipt.category == category)
        
        if start_date and start_date != '':
            try:
                query = query.filter(Receipt.date >= datetime.fromisoformat(start_date).date())
            except Exception as e:
                print(f"DEBUG: Invalid start_date {start_date}: {e}")
                
        if end_date and end_date != '':
            try:
                query = query.filter(Receipt.date <= datetime.fromisoformat(end_date).date())
            except Exception as e:
                print(f"DEBUG: Invalid end_date {end_date}: {e}")
                
        if store_name and store_name != '':
            query = query.filter(Receipt.store_name.ilike(f'%{store_name}%'))
        
        # Deep Search: Filter receipts that contain a specific item
        if item_name and item_name != '':
            query = query.join(ReceiptItem).filter(ReceiptItem.item_name.ilike(f'%{item_name}%'))
        
        receipts = query.order_by(Receipt.date.desc()).distinct().all()
        print(f"DEBUG: Found {len(receipts)} receipts")
        
        return jsonify({
            'receipts': [receipt.to_dict() for receipt in receipts],
            'count': len(receipts)
        }), 200
        
    except Exception as e:
        print(f"ERROR in get_receipts: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>', methods=['GET'])
@jwt_required()
def get_receipt(receipt_id):
    """Get a specific receipt by ID"""
    user_id = get_jwt_identity()
    try:
        receipt = Receipt.query.filter_by(receipt_id=receipt_id, user_id=user_id).first()
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        return jsonify(receipt.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>', methods=['PUT'])
@jwt_required()
def update_receipt(receipt_id):
    """Update receipt details"""
    user_id = get_jwt_identity()
    try:
        receipt = Receipt.query.filter_by(receipt_id=receipt_id, user_id=user_id).first()
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        
        data = request.get_json()
        before_snapshot = receipt.to_dict()

        if 'store_name' in data:
            receipt.store_name = data['store_name']
            if not data.get('category'): # Only re-categorize if not manually specified
                receipt.category = auto_categorize(data['store_name'])
        if 'category' in data:
            receipt.category = data['category']
        if 'date' in data:
            receipt.date = datetime.fromisoformat(data['date']).date()
        if 'total_incl_vat' in data:
            receipt.total_incl_vat = float(data['total_incl_vat'])
        if 'vat_amount' in data:
            receipt.vat_amount = float(data['vat_amount'])
            receipt.total_excl_vat = receipt.total_incl_vat - receipt.vat_amount
            if receipt.total_excl_vat > 0:
                receipt.vat_rate = (receipt.vat_amount / receipt.total_excl_vat) * 100
        if 'notes' in data:
            receipt.notes = data['notes']
        if 'payment_method' in data:
            receipt.payment_method = data['payment_method']
        
        db.session.commit()

        # Immutable Audit Log
        audit = AuditLog(
            user_id=user_id,
            action='UPDATE',
            resource_type='RECEIPT',
            resource_id=receipt.receipt_id,
            changes={'before': before_snapshot, 'after': receipt.to_dict()},
            ip_address=request.remote_addr
        )
        db.session.add(audit)
        db.session.commit()
        return jsonify({
            'message': 'Receipt updated successfully',
            'receipt': receipt.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>', methods=['DELETE'])
@jwt_required()
def delete_receipt(receipt_id):
    """Delete a receipt"""
    user_id = get_jwt_identity()
    try:
        receipt = Receipt.query.filter_by(receipt_id=receipt_id, user_id=user_id).first()
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        
        if receipt.image_path:
            delete_from_gcs(receipt.image_path)
        
        # Immutable Audit Log
        audit = AuditLog(
            user_id=user_id,
            action='DELETE',
            resource_type='RECEIPT',
            resource_id=receipt.receipt_id,
            changes={'deleted': receipt.to_dict()},
            ip_address=request.remote_addr
        )
        db.session.add(audit)
        
        db.session.delete(receipt)
        db.session.commit()
        return jsonify({'message': 'Receipt deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

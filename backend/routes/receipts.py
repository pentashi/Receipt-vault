from flask import Blueprint, request, jsonify, g, send_from_directory
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import uuid
import shutil
import traceback

from models import db, Receipt, ReceiptItem, REVIEW_STATUSES, normalize_trn
from services.ocr_service import OCRService
from services.fx_service import fx_service
from services.tenancy import company_required, receipt_scope, audit
from config import Config

receipts_bp = Blueprint('receipts', __name__)

ocr_service = OCRService()

storage_client = None
if Config.GCS_BUCKET_NAME:
    try:
        from google.cloud import storage
        storage_client = storage.Client()
    except Exception as e:
        print(f"GCS unavailable, storing receipts on local disk: {e}")


def store_file(filepath, filename, content_type=None):
    """Save the receipt image to GCS when configured, otherwise to local disk. Returns a URL."""
    if storage_client:
        blob = storage_client.bucket(Config.GCS_BUCKET_NAME).blob(f"receipts/{filename}")
        blob.upload_from_filename(filepath, content_type=content_type)
        return blob.public_url
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    shutil.copy(filepath, os.path.join(Config.UPLOAD_FOLDER, filename))
    return f"/api/v1/receipts/files/{filename}"


def delete_file(url):
    try:
        if not url:
            return
        if url.startswith('/api/v1/receipts/files/'):
            path = os.path.join(Config.UPLOAD_FOLDER, os.path.basename(url))
            if os.path.exists(path):
                os.remove(path)
        elif storage_client and Config.GCS_BUCKET_NAME in url:
            name = url.split(f"{Config.GCS_BUCKET_NAME}/")[-1]
            storage_client.bucket(Config.GCS_BUCKET_NAME).blob(name).delete()
    except Exception as e:
        print(f"Error deleting receipt file: {e}")


CATEGORY_KEYWORDS = [
    ('Fuel & Vehicle', ['petrol', 'enoc', 'eppco', 'adnoc', 'emarat', 'fuel', 'cafu', 'gas station', 'autopro',
                        'tyre', 'garage', 'auto repair', 'car wash', 'salik', 'rta', 'parking', 'mawaqif']),
    ('Utilities (DEWA/SEWA)', ['dewa', 'sewa', 'fewa', 'addc', 'aadc', 'empower', 'emcool', 'tabreed']),
    ('Telecom & Internet', ['etisalat', 'e&', ' du ', 'du business', 'virgin mobile', 'telecom', 'internet']),
    ('Logistics & Courier', ['dhl', 'fedex', 'aramex', 'emirates post', 'ups', 'courier', 'shipping', 'cargo']),
    ('Transport & Travel', ['taxi', 'metro', 'uber', 'careem', 'nol', 'emirates airline', 'flydubai', 'etihad',
                            'air arabia', 'hotel', 'booking.com', 'airbnb', 'travel']),
    ('Meals & Entertainment', ['restaurant', 'cafe', 'coffee', 'cafeteria', 'starbucks', 'costa', 'bakery',
                               'shawarma', 'talabat', 'deliveroo', 'noon food', 'zomato', 'dining', 'grill', 'kitchen']),
    ('IT, Software & Equipment', ['sharaf', 'e-max', 'jumbo', 'electronics', 'apple', 'samsung', 'computer',
                                  'microsoft', 'google', 'aws', 'adobe', 'zoom', 'software', 'printer', 'virgin megastore']),
    ('Marketing & Advertising', ['print', 'signage', 'advert', 'marketing', 'meta platforms', 'facebook', 'linkedin', 'media']),
    ('Government & Licensing', ['dubai economy', 'ded', 'mohre', 'ica', 'amer', 'tasheel', 'tawjeeh', 'typing',
                                'court', 'municipality', 'customs', 'chamber of commerce', 'free zone', 'dmcc', 'ifza']),
    ('Rent & Facilities', ['rent', 'real estate', 'property', 'ejari', 'wasl', 'emaar', 'nakheel', 'business centre',
                           'coworking', 'regus', 'facility']),
    ('Maintenance & Repairs', ['maintenance', 'repair', 'cleaning', 'pest control', 'ac service', 'plumbing', 'electrical']),
    ('Professional Services', ['legal', 'law firm', 'advocates', 'audit', 'accounting', 'consult', 'notary']),
    ('Office & Supplies', ['office', 'stationery', 'supplies', 'ikea', 'ace hardware', 'dragon mart', 'carrefour',
                           'lulu', 'spinneys', 'union coop', 'water delivery']),
]


def auto_categorize(store_name):
    name = f" {(store_name or '').lower()} "
    for category, words in CATEGORY_KEYWORDS:
        if any(word in name for word in words):
            return category
    return 'Other'


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


@receipts_bp.route('/files/<path:filename>', methods=['GET'])
def serve_file(filename):
    return send_from_directory(Config.UPLOAD_FOLDER, os.path.basename(filename))


@receipts_bp.route('/upload', methods=['POST'])
@company_required()
def upload_receipt():
    filepath = None
    try:
        file = request.files.get('file')
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, pdf'}), 400

        filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
        temp_dir = "/tmp/receiptvault_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        filepath = os.path.join(temp_dir, filename)
        file.save(filepath)

        receipt_data = None
        if ocr_service.available:
            receipt_data = ocr_service.parse_receipt(filepath)
            if str(receipt_data.get('store_name', '')).startswith('Error:'):
                receipt_data = None
        read_ok = receipt_data is not None
        receipt_data = receipt_data or {}

        currency = receipt_data.get('currency') or 'AED'
        original_amount = receipt_data.get('total_incl_vat', 0) or 0
        total_aed, rate = fx_service.convert_to_aed(original_amount, currency)
        vat_aed = round((receipt_data.get('vat_amount') or 0) * rate, 2)

        image_url = store_file(filepath, filename, file.content_type)
        store_name = receipt_data.get('store_name') or 'Unreadable receipt'

        receipt = Receipt(
            user_id=g.user_id,
            company_id=g.company_id,
            receipt_id=str(uuid.uuid4()),
            store_name=store_name,
            address=receipt_data.get('address'),
            phone_number=receipt_data.get('phone_number'),
            date=receipt_data.get('date') or datetime.now().date(),
            time=receipt_data.get('time'),
            currency=currency,
            exchange_rate=rate,
            original_amount=original_amount,
            total_incl_vat=total_aed,
            vat_amount=vat_aed,
            total_excl_vat=round(total_aed - vat_aed, 2),
            vat_rate=receipt_data.get('vat_rate', Config.VAT_RATE),
            payment_method=receipt_data.get('payment_method'),
            transaction_trn=normalize_trn(receipt_data.get('transaction_trn')),
            image_path=image_url,
            category=auto_categorize(store_name) if read_ok else 'Other',
            raw_extraction=receipt_data.get('raw_extraction'),
            status='pending',
            notes=None if read_ok else "We couldn't read this receipt automatically. Please fill in the details.",
        )
        db.session.add(receipt)
        db.session.flush()
        for item in receipt_data.get('items', []):
            db.session.add(ReceiptItem(
                receipt_id=receipt.id,
                item_name=item['item_name'],
                quantity=item.get('quantity', 1),
                price=item.get('price', 0),
            ))
        audit('CREATE', 'RECEIPT', receipt.receipt_id, {'source': 'upload', 'auto_read': read_ok})
        db.session.commit()
        return jsonify({'message': 'Receipt uploaded', 'auto_read': read_ok, 'receipt': receipt.to_dict()}), 201
    except Exception as e:
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)


def _apply_amounts(receipt, data):
    if 'total_incl_vat' in data:
        receipt.total_incl_vat = round(float(data['total_incl_vat'] or 0), 2)
        receipt.original_amount = receipt.total_incl_vat if (receipt.currency or 'AED') == 'AED' else receipt.original_amount
    if 'vat_amount' in data:
        receipt.vat_amount = round(float(data['vat_amount'] or 0), 2)
    if 'total_incl_vat' in data or 'vat_amount' in data:
        receipt.total_excl_vat = round(float(receipt.total_incl_vat or 0) - float(receipt.vat_amount or 0), 2)
        net = float(receipt.total_excl_vat)
        receipt.vat_rate = round(float(receipt.vat_amount or 0) / net * 100, 2) if net > 0 else 0


@receipts_bp.route('/manual', methods=['POST'])
@company_required()
def create_manual_receipt():
    try:
        data = request.get_json() or {}
        store_name = (data.get('store_name') or '').strip() or 'Manual entry'
        date_str = data.get('date')
        receipt = Receipt(
            user_id=g.user_id,
            company_id=g.company_id,
            receipt_id=str(uuid.uuid4()),
            store_name=store_name,
            transaction_trn=normalize_trn(data.get('transaction_trn')),
            date=datetime.fromisoformat(date_str).date() if date_str else datetime.now().date(),
            currency='AED',
            exchange_rate=1.0,
            total_incl_vat=0,
            vat_amount=0,
            total_excl_vat=0,
            category=data.get('category') or auto_categorize(store_name),
            payment_method=data.get('payment_method', 'Cash'),
            notes=data.get('notes'),
            status='pending',
        )
        _apply_amounts(receipt, {'total_incl_vat': data.get('total_incl_vat', 0), 'vat_amount': data.get('vat_amount', 0)})
        db.session.add(receipt)
        db.session.flush()
        audit('CREATE', 'RECEIPT', receipt.receipt_id, {'source': 'manual'})
        db.session.commit()
        return jsonify({'message': 'Receipt added', 'receipt': receipt.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/', methods=['GET'])
@company_required()
def get_receipts():
    try:
        args = request.args
        query = receipt_scope(Receipt.query, Receipt)
        if args.get('category') and args.get('category') != 'all':
            query = query.filter(Receipt.category == args['category'])
        if args.get('status') and args.get('status') != 'all':
            query = query.filter(Receipt.status == args['status'])
        if args.get('start_date'):
            query = query.filter(Receipt.date >= datetime.fromisoformat(args['start_date']).date())
        if args.get('end_date'):
            query = query.filter(Receipt.date <= datetime.fromisoformat(args['end_date']).date())
        if args.get('store_name'):
            query = query.filter(Receipt.store_name.ilike(f"%{args['store_name']}%"))
        if args.get('item_name'):
            query = query.join(ReceiptItem).filter(ReceiptItem.item_name.ilike(f"%{args['item_name']}%"))

        receipts = [r for r in query.order_by(Receipt.date.desc(), Receipt.id.desc()).distinct().all()]
        if args.get('issue') == 'missing_trn':
            receipts = [r for r in receipts if r.vat_issue == 'missing_trn']
        return jsonify({'receipts': [r.to_dict() for r in receipts], 'count': len(receipts)}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def _find(receipt_id):
    return receipt_scope(Receipt.query, Receipt).filter(Receipt.receipt_id == receipt_id).first()


@receipts_bp.route('/<receipt_id>', methods=['GET'])
@company_required()
def get_receipt(receipt_id):
    receipt = _find(receipt_id)
    if not receipt:
        return jsonify({'error': 'Receipt not found'}), 404
    return jsonify(receipt.to_dict()), 200


@receipts_bp.route('/<receipt_id>', methods=['PUT'])
@company_required()
def update_receipt(receipt_id):
    try:
        receipt = _find(receipt_id)
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        if g.role == 'staff' and receipt.status == 'approved':
            return jsonify({'error': 'Approved receipts can only be changed by the owner or accountant'}), 403

        data = request.get_json() or {}
        before = receipt.to_dict()
        if 'store_name' in data:
            receipt.store_name = (data['store_name'] or '').strip() or receipt.store_name
            if not data.get('category'):
                receipt.category = auto_categorize(receipt.store_name)
        if data.get('category'):
            receipt.category = data['category']
        if 'transaction_trn' in data:
            receipt.transaction_trn = normalize_trn(data['transaction_trn'])
        if data.get('date'):
            receipt.date = datetime.fromisoformat(data['date']).date()
        _apply_amounts(receipt, data)
        if 'notes' in data:
            receipt.notes = data['notes']
        if 'payment_method' in data:
            receipt.payment_method = data['payment_method']
        if g.role == 'staff' and receipt.status == 'rejected':
            receipt.status = 'pending'

        audit('UPDATE', 'RECEIPT', receipt.receipt_id, {'before': before, 'after': receipt.to_dict()})
        db.session.commit()
        return jsonify({'message': 'Receipt updated', 'receipt': receipt.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@receipts_bp.route('/<receipt_id>/review', methods=['POST'])
@company_required(roles=('owner', 'accountant'))
def review_receipt(receipt_id):
    receipt = _find(receipt_id)
    if not receipt:
        return jsonify({'error': 'Receipt not found'}), 404
    data = request.get_json() or {}
    status = data.get('status')
    if status not in REVIEW_STATUSES:
        return jsonify({'error': 'Status must be pending, approved or rejected'}), 400
    receipt.status = status
    receipt.review_note = data.get('note') or None
    receipt.reviewed_by = g.user_id if status != 'pending' else None
    receipt.reviewed_at = datetime.utcnow() if status != 'pending' else None
    audit('REVIEW', 'RECEIPT', receipt.receipt_id, {'status': status, 'note': receipt.review_note})
    db.session.commit()
    return jsonify({'receipt': receipt.to_dict()}), 200


@receipts_bp.route('/<receipt_id>', methods=['DELETE'])
@company_required()
def delete_receipt(receipt_id):
    try:
        receipt = _find(receipt_id)
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404
        if g.role == 'staff' and receipt.status == 'approved':
            return jsonify({'error': 'Approved receipts can only be deleted by the owner or accountant'}), 403
        delete_file(receipt.image_path)
        audit('DELETE', 'RECEIPT', receipt.receipt_id, {'deleted': receipt.to_dict()})
        db.session.delete(receipt)
        db.session.commit()
        return jsonify({'message': 'Receipt deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

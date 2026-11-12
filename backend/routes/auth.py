from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from models import db, User, Company, Membership
from services.tenancy import accept_pending_invites
from services.demo_seed import seed_demo_company
import uuid

auth_bp = Blueprint('auth', __name__)


def _session_payload(user, status=200):
    memberships = Membership.query.filter_by(user_id=user.id).order_by(Membership.id).all()
    return jsonify({
        'user': user.to_dict(),
        'companies': [{'role': m.role, **m.company.to_dict()} for m in memberships],
        'access_token': create_access_token(identity=str(user.id)),
    }), status


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    name = (data.get('name') or '').strip()
    company_name = (data.get('company_name') or '').strip()

    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400
    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters'}), 400
    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({'message': 'An account with this email already exists'}), 409

    user = User(email=email, name=name or email.split('@')[0])
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    invited = accept_pending_invites(user)
    if company_name or not invited:
        company = Company(name=company_name or f"{user.name}'s Business", trn=data.get('company_trn') or None)
        db.session.add(company)
        db.session.flush()
        db.session.add(Membership(user_id=user.id, company_id=company.id, role='owner'))

    db.session.commit()
    return _session_payload(user, 201)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user or not user.check_password(password):
        return jsonify({'message': 'Invalid email or password'}), 401

    if accept_pending_invites(user):
        db.session.commit()
    return _session_payload(user)


@auth_bp.route('/guest-login', methods=['POST'])
def guest_login():
    """Create an isolated demo account with a sample company and receipts."""
    try:
        session_id = str(uuid.uuid4())
        user = User(email=f'guest_{session_id}@vault.local', name='Demo Owner', is_guest=True)
        user.set_password(session_id)
        db.session.add(user)
        db.session.flush()
        seed_demo_company(user)
        db.session.commit()
        return _session_payload(user, 201)
    except Exception as e:
        db.session.rollback()
        print(f"guest_login failed: {e}")
        return jsonify({'error': 'Demo is restarting, please try again in a moment.'}), 503


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'message': 'User not found'}), 404
    memberships = Membership.query.filter_by(user_id=user.id).order_by(Membership.id).all()
    return jsonify({
        'user': user.to_dict(),
        'companies': [{'role': m.role, **m.company.to_dict()} for m in memberships],
    }), 200

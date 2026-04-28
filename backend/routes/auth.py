from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from models import db, User
from datetime import datetime
import uuid

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'User already exists'}), 409
    
    user = User(email=email, name=name)
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'user': user.to_dict(),
        'access_token': access_token
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login a user"""
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'message': 'Email and password are required'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.check_password(password):
        return jsonify({'message': 'Invalid email or password'}), 401
    
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        'user': user.to_dict(),
        'access_token': access_token
    }), 200

@auth_bp.route('/guest-login', methods=['POST'])
def guest_login():
    """Create a truly unique guest user for every session (Isolated Data)"""
    try:
        # 16K Engineer Logic: Always create a fresh unique ID to ensure isolated data
        session_id = str(uuid.uuid4())
        guest_id = session_id[:8]
        email = f'guest_{session_id}@vault.local'
        name = f'Explorer {guest_id}'
        
        user = User(email=email, name=name, is_guest=True)
        user.set_password(session_id) # Random unique password
        
        db.session.add(user)
        db.session.commit()
        
        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            'user': user.to_dict(),
            'access_token': access_token
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'System is re-initializing, please try again in a moment.'}), 503

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get the current logged-in user details"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    return jsonify(user.to_dict()), 200

from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
import re

from models import db, User

auth_bp = Blueprint('auth', __name__)

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
_MIN_PASSWORD_LENGTH = 8


def _validate_credentials(email: str, password: str):
    """Return an error string if credentials are invalid, otherwise None."""
    if not _EMAIL_RE.match(email):
        return 'Please enter a valid email address'
    if len(password) < _MIN_PASSWORD_LENGTH:
        return f'Password must be at least {_MIN_PASSWORD_LENGTH} characters'
    return None


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        email = data['email'].strip().lower()

        err = _validate_credentials(email, data['password'])
        if err:
            return jsonify({'error': err}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'An account with this email already exists'}), 409

        user = User(
            email=email,
            name=data.get('name', '').strip(),
            password_hash=generate_password_hash(data['password']),
        )
        db.session.add(user)
        db.session.commit()

        session.clear()
        session['user_id'] = user.id
        return jsonify({'message': 'Account created successfully', 'user': user.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login with email and password"""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        email = data['email'].strip().lower()

        err = _validate_credentials(email, data['password'])
        if err:
            return jsonify({'error': err}), 400

        user = User.query.filter_by(email=email).first()

        if not user or not user.password_hash or not check_password_hash(user.password_hash, data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401

        session.clear()
        session['user_id'] = user.id
        return jsonify({'message': 'Logged in successfully', 'user': user.to_dict()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout the current user"""
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200


@auth_bp.route('/me', methods=['GET'])
def me():
    """Get the currently logged-in user"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'user': None}), 200

    user = User.query.get(user_id)
    if not user:
        session.pop('user_id', None)
        return jsonify({'user': None}), 200

    return jsonify({'user': user.to_dict()}), 200

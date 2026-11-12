from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity

from config import Config
from models import db, Company, Membership, Invite, User, ROLES, is_valid_trn, normalize_trn
from services.tenancy import company_required, audit

companies_bp = Blueprint('companies', __name__)


def _apply_company_fields(company, data):
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return 'Company name is required'
        company.name = name
    if 'trn' in data:
        trn = normalize_trn(data.get('trn'))
        if trn and not is_valid_trn(trn):
            return 'A UAE TRN has 15 digits'
        company.trn = trn
    if 'emirate' in data:
        if data['emirate'] not in Config.EMIRATES:
            return 'Unknown emirate'
        company.emirate = data['emirate']
    if 'vat_quarter_start_month' in data:
        month = int(data['vat_quarter_start_month'])
        if month not in (1, 2, 3):
            return 'VAT quarter start month must be 1, 2 or 3'
        company.vat_quarter_start_month = month
    return None


@companies_bp.route('/', methods=['GET'])
@jwt_required()
def list_companies():
    user_id = int(get_jwt_identity())
    memberships = Membership.query.filter_by(user_id=user_id).order_by(Membership.id).all()
    return jsonify({'companies': [{'role': m.role, **m.company.to_dict()} for m in memberships]}), 200


@companies_bp.route('/', methods=['POST'])
@jwt_required()
def create_company():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    company = Company(name='')
    error = _apply_company_fields(company, {'name': data.get('name', ''), **data})
    if error:
        return jsonify({'error': error}), 400
    db.session.add(company)
    db.session.flush()
    db.session.add(Membership(user_id=user_id, company_id=company.id, role='owner'))
    db.session.commit()
    return jsonify({'company': {'role': 'owner', **company.to_dict()}}), 201


@companies_bp.route('/current', methods=['GET'])
@company_required()
def current_company():
    return jsonify({'company': {'role': g.role, **g.company.to_dict()}}), 200


@companies_bp.route('/current', methods=['PUT'])
@company_required(roles=('owner',))
def update_company():
    data = request.get_json() or {}
    before = g.company.to_dict()
    error = _apply_company_fields(g.company, data)
    if error:
        return jsonify({'error': error}), 400
    audit('UPDATE', 'COMPANY', g.company_id, {'before': before, 'after': g.company.to_dict()})
    db.session.commit()
    return jsonify({'company': {'role': g.role, **g.company.to_dict()}}), 200


@companies_bp.route('/current/members', methods=['GET'])
@company_required()
def list_members():
    members = Membership.query.filter_by(company_id=g.company_id).order_by(Membership.id).all()
    invites = Invite.query.filter_by(company_id=g.company_id, accepted_at=None).order_by(Invite.id).all()
    return jsonify({
        'members': [{'id': m.id, 'role': m.role, 'user': m.user.to_dict()} for m in members],
        'invites': [i.to_dict() for i in invites] if g.role == 'owner' else [],
    }), 200


@companies_bp.route('/current/invites', methods=['POST'])
@company_required(roles=('owner',))
def invite_member():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    role = data.get('role', 'staff')
    if not email or '@' not in email:
        return jsonify({'error': 'A valid email is required'}), 400
    if role not in ROLES:
        return jsonify({'error': 'Unknown role'}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user:
        if Membership.query.filter_by(user_id=user.id, company_id=g.company_id).first():
            return jsonify({'error': 'This person is already on the team'}), 409
        membership = Membership(user_id=user.id, company_id=g.company_id, role=role)
        db.session.add(membership)
        audit('CREATE', 'MEMBERSHIP', email, {'role': role})
        db.session.commit()
        return jsonify({'added': True, 'member': {'id': membership.id, 'role': role, 'user': user.to_dict()}}), 201

    if Invite.query.filter_by(company_id=g.company_id, email=email, accepted_at=None).first():
        return jsonify({'error': 'An invite for this email is already pending'}), 409
    invite = Invite(company_id=g.company_id, email=email, role=role, invited_by=g.user_id)
    db.session.add(invite)
    audit('CREATE', 'INVITE', email, {'role': role})
    db.session.commit()
    return jsonify({'added': False, 'invite': invite.to_dict()}), 201


@companies_bp.route('/current/members/<int:membership_id>', methods=['PUT'])
@company_required(roles=('owner',))
def update_member(membership_id):
    membership = Membership.query.filter_by(id=membership_id, company_id=g.company_id).first()
    if not membership:
        return jsonify({'error': 'Member not found'}), 404
    role = (request.get_json() or {}).get('role')
    if role not in ROLES:
        return jsonify({'error': 'Unknown role'}), 400
    if membership.user_id == g.user_id and role != 'owner':
        return jsonify({'error': "You can't change your own owner role"}), 400
    membership.role = role
    audit('UPDATE', 'MEMBERSHIP', membership.user.email, {'role': role})
    db.session.commit()
    return jsonify({'member': {'id': membership.id, 'role': role, 'user': membership.user.to_dict()}}), 200


@companies_bp.route('/current/members/<int:membership_id>', methods=['DELETE'])
@company_required(roles=('owner',))
def remove_member(membership_id):
    membership = Membership.query.filter_by(id=membership_id, company_id=g.company_id).first()
    if not membership:
        return jsonify({'error': 'Member not found'}), 404
    if membership.user_id == g.user_id:
        return jsonify({'error': "You can't remove yourself"}), 400
    audit('DELETE', 'MEMBERSHIP', membership.user.email)
    db.session.delete(membership)
    db.session.commit()
    return jsonify({'message': 'Member removed'}), 200


@companies_bp.route('/current/invites/<int:invite_id>', methods=['DELETE'])
@company_required(roles=('owner',))
def cancel_invite(invite_id):
    invite = Invite.query.filter_by(id=invite_id, company_id=g.company_id, accepted_at=None).first()
    if not invite:
        return jsonify({'error': 'Invite not found'}), 404
    db.session.delete(invite)
    db.session.commit()
    return jsonify({'message': 'Invite cancelled'}), 200


@companies_bp.route('/meta', methods=['GET'])
def meta():
    return jsonify({'emirates': Config.EMIRATES, 'roles': list(ROLES)}), 200

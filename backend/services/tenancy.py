from functools import wraps
from flask import request, jsonify, g, abort, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Membership, Invite, AuditLog


def _deny(status, message):
    abort(make_response(jsonify({'error': message}), status))


def company_required(roles=None):
    """Resolve the active company from the X-Company-Id header and check the caller's role.

    Sets g.user_id, g.company_id, g.company, g.role and g.membership.
    """
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user_id = int(get_jwt_identity())
            query = Membership.query.filter_by(user_id=user_id)
            header = request.headers.get('X-Company-Id')
            if header and header.isdigit():
                membership = query.filter_by(company_id=int(header)).first()
            else:
                membership = query.order_by(Membership.id).first()
            if not membership:
                _deny(403, 'You are not a member of this company')
            if roles and membership.role not in roles:
                _deny(403, 'Your role does not allow this action')
            g.user_id = user_id
            g.membership = membership
            g.company = membership.company
            g.company_id = membership.company_id
            g.role = membership.role
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def receipt_scope(query, model):
    """Limit a receipt query to the active company; staff only see their own uploads."""
    query = query.filter(model.company_id == g.company_id)
    if g.role == 'staff':
        query = query.filter(model.user_id == g.user_id)
    return query


def accept_pending_invites(user):
    invites = Invite.query.filter(
        db.func.lower(Invite.email) == user.email.lower(),
        Invite.accepted_at.is_(None),
    ).all()
    from datetime import datetime
    for invite in invites:
        exists = Membership.query.filter_by(user_id=user.id, company_id=invite.company_id).first()
        if not exists:
            db.session.add(Membership(user_id=user.id, company_id=invite.company_id, role=invite.role))
        invite.accepted_at = datetime.utcnow()
    return len(invites)


def audit(action, resource_type, resource_id, changes=None):
    db.session.add(AuditLog(
        user_id=g.user_id,
        company_id=getattr(g, 'company_id', None),
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        changes=changes,
        ip_address=request.remote_addr,
    ))

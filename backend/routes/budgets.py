from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, extract
from datetime import datetime

from models import db, Budget, Receipt, AuditLog
from config import Config

budgets_bp = Blueprint('budgets', __name__)


def calculate_budget_progress(budget, month, year, user_id):

    """Helper to calculate spending progress for a budget"""
    # Get actual spending for this category
    actual_spending = db.session.query(
        func.sum(Receipt.total_incl_vat)
    ).filter(
        Receipt.user_id == user_id,
        Receipt.category == budget.category,
        extract('month', Receipt.date) == month,
        extract('year', Receipt.date) == year
    ).scalar() or 0
    
    actual_spending_float = float(actual_spending)
    monthly_limit_float = float(budget.monthly_limit)
    alert_threshold_float = float(budget.alert_threshold)
    
    budget_dict = budget.to_dict()
    budget_dict['actual_spending'] = actual_spending_float
    budget_dict['remaining'] = monthly_limit_float - actual_spending_float
    budget_dict['percentage_used'] = (actual_spending_float / monthly_limit_float * 100) if monthly_limit_float > 0 else 0
    budget_dict['is_exceeded'] = actual_spending_float > monthly_limit_float
    budget_dict['alert_triggered'] = (actual_spending_float / monthly_limit_float * 100) >= alert_threshold_float if monthly_limit_float > 0 else False
    
    return budget_dict


@budgets_bp.route('/', methods=['GET'])
@jwt_required()
def get_budgets():
    """Get all budgets for a specific month/year"""
    user_id = get_jwt_identity()
    try:
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        
        budgets = Budget.query.filter_by(user_id=user_id, month=month, year=year).all()
        
        budget_data = [calculate_budget_progress(b, month, year, user_id) for b in budgets]
        
        return jsonify({
            'budgets': budget_data,
            'month': month,
            'year': year
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/', methods=['POST'])
@jwt_required()
def create_budget():
    """Create a new budget"""
    user_id = get_jwt_identity()
    try:
        data = request.get_json()
        
        category = data.get('category').title() if data.get('category') else None
        monthly_limit = data.get('monthly_limit')
        month = data.get('month', datetime.now().month)
        year = data.get('year', datetime.now().year)
        
        if not category or not monthly_limit:
            return jsonify({'error': 'Category and monthly_limit are required'}), 400
        
        # Check if budget already exists for this category/month/year
        existing_budget = Budget.query.filter_by(
            user_id=user_id,
            category=category,
            month=month,
            year=year
        ).first()
        
        if existing_budget:
            return jsonify({'error': 'Budget already exists for this category and period'}), 400
        
        budget = Budget(
            user_id=user_id,
            category=category,
            monthly_limit=monthly_limit,
            month=month,
            year=year,
            alert_threshold=data.get('alert_threshold', 80.0)
        )
        
        db.session.add(budget)
        db.session.flush()

        # Immutable Audit Log
        audit = AuditLog(
            user_id=user_id,
            action='CREATE',
            resource_type='BUDGET',
            resource_id=str(budget.id),
            changes={'new': budget.to_dict()},
            ip_address=request.remote_addr
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            'message': 'Budget created successfully',
            'budget': calculate_budget_progress(budget, month, year, user_id)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/<int:budget_id>', methods=['PUT'])
@jwt_required()
def update_budget(budget_id):
    """Update an existing budget"""
    user_id = get_jwt_identity()
    try:
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id).first()
        
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        data = request.get_json()
        before_snapshot = budget.to_dict()
        
        if 'monthly_limit' in data:
            budget.monthly_limit = data['monthly_limit']
        
        if 'alert_threshold' in data:
            budget.alert_threshold = data['alert_threshold']
        
        db.session.commit()

        # Immutable Audit Log
        audit = AuditLog(
            user_id=user_id,
            action='UPDATE',
            resource_type='BUDGET',
            resource_id=str(budget.id),
            changes={'before': before_snapshot, 'after': budget.to_dict()},
            ip_address=request.remote_addr
        )
        db.session.add(audit)
        db.session.commit()
        
        return jsonify({
            'message': 'Budget updated successfully',
            'budget': calculate_budget_progress(budget, budget.month, budget.year, user_id)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/<int:budget_id>', methods=['DELETE'])
@jwt_required()
def delete_budget(budget_id):
    """Delete a budget"""
    user_id = get_jwt_identity()
    try:
        budget = Budget.query.filter_by(id=budget_id, user_id=user_id).first()
        
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        db.session.delete(budget)
        db.session.commit()
        
        return jsonify({'message': 'Budget deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_budget_alerts():
    """Get all budget alerts (budgets that have exceeded alert threshold)"""
    user_id = get_jwt_identity()
    try:
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        
        budgets = Budget.query.filter_by(user_id=user_id, month=month, year=year).all()
        
        alerts = []
        for budget in budgets:
            # Get actual spending for this category
            actual_spending = db.session.query(
                func.sum(Receipt.total_incl_vat)
            ).filter(
                Receipt.user_id == user_id,
                Receipt.category == budget.category,
                extract('month', Receipt.date) == month,
                extract('year', Receipt.date) == year
            ).scalar() or 0
            
            actual_spending_float = float(actual_spending)
            monthly_limit_float = float(budget.monthly_limit)
            alert_threshold_float = float(budget.alert_threshold)
            
            percentage_used = (actual_spending_float / monthly_limit_float * 100) if monthly_limit_float > 0 else 0
            
            if percentage_used >= alert_threshold_float:
                alert_data = budget.to_dict()
                alert_data['actual_spending'] = actual_spending_float
                alert_data['percentage_used'] = percentage_used
                alert_data['is_exceeded'] = actual_spending_float > monthly_limit_float
                
                alert_type = 'exceeded' if actual_spending_float > monthly_limit_float else 'warning'
                alert_data['alert_type'] = alert_type
                alert_data['message'] = f"You've {'exceeded' if alert_type == 'exceeded' else 'reached'} {percentage_used:.1f}% of your {budget.category} budget"
                
                alerts.append(alert_data)
        
        return jsonify({
            'alerts': alerts,
            'count': len(alerts)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

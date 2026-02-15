from flask import Blueprint, request, jsonify
from sqlalchemy import func, extract
from datetime import datetime

from models import db, Budget, Receipt
from config import Config

budgets_bp = Blueprint('budgets', __name__)


@budgets_bp.route('/', methods=['GET'])
def get_budgets():
    """Get all budgets for a specific month/year"""
    try:
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        
        budgets = Budget.query.filter_by(month=month, year=year).all()
        
        # Calculate actual spending for each category
        budget_data = []
        for budget in budgets:
            # Get actual spending for this category
            actual_spending = db.session.query(
                func.sum(Receipt.total_incl_vat)
            ).filter(
                Receipt.category == budget.category,
                extract('month', Receipt.date) == month,
                extract('year', Receipt.date) == year
            ).scalar() or 0
            
            budget_dict = budget.to_dict()
            budget_dict['actual_spending'] = float(actual_spending)
            budget_dict['remaining'] = float(budget.monthly_limit) - float(actual_spending)
            budget_dict['percentage_used'] = (float(actual_spending) / float(budget.monthly_limit) * 100) if budget.monthly_limit > 0 else 0
            budget_dict['is_exceeded'] = actual_spending > budget.monthly_limit
            budget_dict['alert_triggered'] = (actual_spending / budget.monthly_limit * 100) >= budget.alert_threshold if budget.monthly_limit > 0 else False
            
            budget_data.append(budget_dict)
        
        return jsonify({
            'budgets': budget_data,
            'month': month,
            'year': year
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/', methods=['POST'])
def create_budget():
    """Create a new budget"""
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
            category=category,
            month=month,
            year=year
        ).first()
        
        if existing_budget:
            return jsonify({'error': 'Budget already exists for this category and period'}), 400
        
        budget = Budget(
            category=category,
            monthly_limit=monthly_limit,
            month=month,
            year=year,
            alert_threshold=data.get('alert_threshold', 80.0)
        )
        
        db.session.add(budget)
        db.session.commit()
        
        return jsonify({
            'message': 'Budget created successfully',
            'budget': budget.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/<int:budget_id>', methods=['PUT'])
def update_budget(budget_id):
    """Update an existing budget"""
    try:
        budget = Budget.query.get(budget_id)
        
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        data = request.get_json()
        
        if 'monthly_limit' in data:
            budget.monthly_limit = data['monthly_limit']
        
        if 'alert_threshold' in data:
            budget.alert_threshold = data['alert_threshold']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Budget updated successfully',
            'budget': budget.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    """Delete a budget"""
    try:
        budget = Budget.query.get(budget_id)
        
        if not budget:
            return jsonify({'error': 'Budget not found'}), 404
        
        db.session.delete(budget)
        db.session.commit()
        
        return jsonify({'message': 'Budget deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@budgets_bp.route('/alerts', methods=['GET'])
def get_budget_alerts():
    """Get all budget alerts (budgets that have exceeded alert threshold)"""
    try:
        month = request.args.get('month', datetime.now().month, type=int)
        year = request.args.get('year', datetime.now().year, type=int)
        
        budgets = Budget.query.filter_by(month=month, year=year).all()
        
        alerts = []
        for budget in budgets:
            # Get actual spending for this category
            actual_spending = db.session.query(
                func.sum(Receipt.total_incl_vat)
            ).filter(
                Receipt.category == budget.category,
                extract('month', Receipt.date) == month,
                extract('year', Receipt.date) == year
            ).scalar() or 0
            
            percentage_used = (float(actual_spending) / float(budget.monthly_limit) * 100) if budget.monthly_limit > 0 else 0
            
            if percentage_used >= budget.alert_threshold:
                alert_data = budget.to_dict()
                alert_data['actual_spending'] = float(actual_spending)
                alert_data['percentage_used'] = percentage_used
                alert_data['is_exceeded'] = actual_spending > budget.monthly_limit
                
                alert_type = 'exceeded' if actual_spending > budget.monthly_limit else 'warning'
                alert_data['alert_type'] = alert_type
                alert_data['message'] = f"You've {'exceeded' if alert_type == 'exceeded' else 'reached'} {percentage_used:.1f}% of your {budget.category} budget"
                
                alerts.append(alert_data)
        
        return jsonify({
            'alerts': alerts,
            'count': len(alerts)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

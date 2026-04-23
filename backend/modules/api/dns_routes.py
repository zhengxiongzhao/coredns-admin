from flask import Blueprint, request, jsonify
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services import DnsService, ConnectionService
from ..database import DatabaseOperations, DatabaseConnection
from ..etcd import EtcdConnectionPool

# 创建蓝图
dns_bp = Blueprint('dns', __name__)

# 初始化服务（将在应用初始化时设置）
dns_service = None
connection_service = None
db_operations = None

def init_dns_routes(database_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
    """初始化DNS路由"""
    global dns_service, connection_service, db_operations
    dns_service = DnsService(database_operations, connection_pool)
    connection_service = ConnectionService(database_operations, connection_pool)
    db_operations = database_operations

@dns_bp.route('/api/dns-records', methods=['GET'])
@jwt_required()
def get_dns_records():
    """获取所有DNS记录（从所有活跃的ETCD实例）"""
    try:
        # 获取参数
        domain = request.args.get('domain')
        custom_base_path = request.args.get('base_path')
        instance_id = request.args.get('instance_id', type=int)
        
        # 如果指定了instance_id，只查询该实例；否则查询所有活跃实例
        if instance_id:
            instance = db_operations.get_etcd_instance(instance_id)
            if not instance:
                return jsonify({"error": f"ETCD instance {instance_id} not found"}), 404
            active_instances = [instance]
        else:
            active_instances = db_operations.get_etcd_instances(active_only=True)
        
        if not active_instances:
            return jsonify([])  # 如果没有活跃实例，返回空列表
        
        all_records = []
        
        # 从每个活跃实例获取DNS记录
        for instance in active_instances:
            try:
                records = dns_service.get_dns_records(
                    instance_id=instance.id,
                    filter_domain=domain,
                    custom_base_path=custom_base_path
                )
                
                # 为每个记录添加实例信息
                for record in records:
                    record_with_instance = {
                        **record,
                        'instance_id': instance.id,
                        'instance_name': instance.name,
                        'instance_host': instance.host,
                        'instance_port': instance.port,
                        'instance_base_path': instance.base_path
                    }
                    all_records.append(record_with_instance)
                    
            except Exception as e:
                # 记录错误但继续处理其他实例
                from flask import current_app
                current_app.logger.warning(f"Failed to get DNS records from instance {instance.id} ({instance.name}): {str(e)}")
                continue
        
        return jsonify(all_records)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/dns-records', methods=['POST'])
@jwt_required()
def create_dns_record():
    """创建DNS记录"""
    try:
        data = request.json
        
        # 获取实例ID
        instance_id = data.get('instance_id')
        if not instance_id:
            # 如果没有指定实例ID，使用当前实例
            current_instance = connection_service.get_current_instance()
            if not current_instance:
                return jsonify({"error": "No active ETCD instance available"}), 400
            instance_id = current_instance['id']
        
        # 验证必需字段
        required_fields = ['domain', 'name', 'type', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        record_data = {
            'domain': data['domain'],
            'name': data['name'],
            'type': data['type'],
            'content': data['content'],
            'ttl': data.get('ttl', 60),
            'priority': data.get('priority', 100),
            'base_path': data.get('base_path')
        }
        
        result = dns_service.create_dns_record(instance_id, record_data)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/dns-records', methods=['PUT'])
@jwt_required()
def update_dns_record():
    """更新DNS记录"""
    try:
        data = request.json
        
        # 获取实例ID
        instance_id = data.get('instance_id')
        if not instance_id:
            # 如果没有指定实例ID，使用当前实例
            current_instance = connection_service.get_current_instance()
            if not current_instance:
                return jsonify({"error": "No active ETCD instance available"}), 400
            instance_id = current_instance['id']
        
        # 验证必需字段
        required_fields = ['key', 'domain', 'name', 'type', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        record_data = {
            'key': data['key'],
            'domain': data['domain'],
            'name': data['name'],
            'type': data['type'],
            'content': data['content'],
            'ttl': data.get('ttl', 60),
            'priority': data.get('priority', 100)
        }
        
        result = dns_service.update_dns_record(instance_id, record_data)
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/dns-records', methods=['DELETE'])
@jwt_required()
def delete_dns_records():
    """删除DNS记录"""
    try:
        # 获取实例ID参数
        instance_id = request.args.get('instance_id', type=int)
        if not instance_id:
            # 如果没有指定实例ID，使用当前实例
            current_instance = connection_service.get_current_instance()
            if not current_instance:
                return jsonify({"error": "No active ETCD instance available"}), 400
            instance_id = current_instance['id']
        
        # 支持两种方式删除：
        # 1. 通过keys参数删除指定记录
        # 2. 通过domain参数删除指定域名的所有记录
        
        keys = request.args.getlist('keys')
        domain = request.args.get('domain')
        
        if keys:
            # 删除指定keys的记录
            deleted_count = 0
            for key in keys:
                if dns_service.delete_dns_record(instance_id, key):
                    deleted_count += 1
            return jsonify({"message": f"{deleted_count} records deleted successfully"})
            
        elif domain:
            # 删除指定域名的所有记录
            custom_base_path = request.args.get('base_path')
            deleted_count = dns_service.delete_dns_records_by_domain(
                instance_id=instance_id,
                domain=domain,
                custom_base_path=custom_base_path
            )
            return jsonify({"message": f"{deleted_count} records deleted successfully"})
            
        else:
            return jsonify({"error": "Either 'keys' or 'domain' parameter is required"}), 400
            
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/dns-records/validate', methods=['POST'])
@jwt_required()
def validate_dns_records():
    """验证DNS记录"""
    try:
        data = request.json
        records = data.get('records', [])
        
        if not isinstance(records, list):
            return jsonify({"error": "Records must be a list"}), 400
        
        result = dns_service.validate_dns_record_batch(records)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/dns-records/batch', methods=['POST'])
@jwt_required()
def create_dns_records_batch():
    """批量创建DNS记录"""
    try:
        data = request.json
        
        # 获取实例ID
        instance_id = data.get('instance_id')
        if not instance_id:
            # 如果没有指定实例ID，使用当前实例
            current_instance = connection_service.get_current_instance()
            if not current_instance:
                return jsonify({"error": "No active ETCD instance available"}), 400
            instance_id = current_instance['id']
        
        # 验证必需字段
        records = data.get('records', [])
        if not isinstance(records, list) or len(records) == 0:
            return jsonify({"error": "Records must be a non-empty list"}), 400
        
        if len(records) > 10:
            return jsonify({"error": "Maximum 10 records allowed per batch"}), 400
        
        result = dns_service.create_dns_records_batch(instance_id, records)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/etcd-instances/<int:instance_id>/dns-records', methods=['GET'])
@jwt_required()
def get_instance_dns_records(instance_id):
    """获取指定ETCD实例的DNS记录"""
    try:
        # 获取参数
        domain = request.args.get('domain')
        custom_base_path = request.args.get('base_path')
        
        records = dns_service.get_dns_records(
            instance_id=instance_id,
            filter_domain=domain,
            custom_base_path=custom_base_path
        )
        
        return jsonify(records)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/etcd-instances/<int:instance_id>/dns-records', methods=['POST'])
@jwt_required()
def create_instance_dns_record(instance_id):
    """在指定ETCD实例上创建DNS记录"""
    try:
        data = request.json
        
        # 验证必需字段
        required_fields = ['domain', 'name', 'type', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        record_data = {
            'domain': data['domain'],
            'name': data['name'],
            'type': data['type'],
            'content': data['content'],
            'ttl': data.get('ttl', 60),
            'priority': data.get('priority', 100),
            'base_path': data.get('base_path')
        }
        
        result = dns_service.create_dns_record(instance_id, record_data)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/etcd-instances/<int:instance_id>/dns-records', methods=['PUT'])
@jwt_required()
def update_instance_dns_record(instance_id):
    """在指定ETCD实例上更新DNS记录"""
    try:
        data = request.json
        
        # 验证必需字段
        required_fields = ['key', 'domain', 'name', 'type', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        record_data = {
            'key': data['key'],
            'domain': data['domain'],
            'name': data['name'],
            'type': data['type'],
            'content': data['content'],
            'ttl': data.get('ttl', 60),
            'priority': data.get('priority', 100)
        }
        
        result = dns_service.update_dns_record(instance_id, record_data)
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@dns_bp.route('/api/etcd-instances/<int:instance_id>/dns-records', methods=['DELETE'])
@jwt_required()
def delete_instance_dns_records(instance_id):
    """删除指定ETCD实例上的DNS记录"""
    try:
        # 支持两种方式删除：
        # 1. 通过keys参数删除指定记录
        # 2. 通过domain参数删除指定域名的所有记录
        
        keys = request.args.getlist('keys')
        domain = request.args.get('domain')
        
        if keys:
            # 删除指定keys的记录
            deleted_count = 0
            for key in keys:
                if dns_service.delete_dns_record(instance_id, key):
                    deleted_count += 1
            return jsonify({"message": f"{deleted_count} records deleted successfully"})
            
        elif domain:
            # 删除指定域名的所有记录
            custom_base_path = request.args.get('base_path')
            deleted_count = dns_service.delete_dns_records_by_domain(
                instance_id=instance_id,
                domain=domain,
                custom_base_path=custom_base_path
            )
            return jsonify({"message": f"{deleted_count} records deleted successfully"})
            
        else:
            return jsonify({"error": "Either 'keys' or 'domain' parameter is required"}), 400
            
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
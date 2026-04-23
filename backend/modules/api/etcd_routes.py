from flask import Blueprint, request, jsonify
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services import EtcdInstanceService
from ..database import DatabaseOperations, DatabaseConnection
from ..etcd import EtcdConnectionPool

# 创建蓝图
etcd_bp = Blueprint('etcd', __name__)

# 初始化服务（将在应用初始化时设置）
etcd_service = None

def init_etcd_routes(db_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
    """初始化ETCD路由"""
    global etcd_service
    etcd_service = EtcdInstanceService(db_operations, connection_pool)

@etcd_bp.route('/api/etcd-instances', methods=['GET'])
@jwt_required()
def get_etcd_instances():
    """获取所有ETCD实例"""
    try:
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
        instances = etcd_service.get_all_instances(include_inactive=include_inactive)
        return jsonify(instances)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances', methods=['POST'])
@jwt_required()
def create_etcd_instance():
    """创建ETCD实例"""
    try:
        data = request.json
        
        # 验证必需字段
        required_fields = ['name', 'host', 'port']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # 设置默认值
        instance_data = {
            'name': data['name'],
            'host': data['host'],
            'port': data['port'],
            'base_path': data.get('base_path', '/skydns'),
            'username': data.get('username'),
            'password': data.get('password'),
            'is_active': data.get('is_active', True),
            'is_default': data.get('is_default', False),
            'description': data.get('description', '')
        }
        
        result = etcd_service.create_instance(instance_data)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/<int:instance_id>', methods=['GET'])
@jwt_required()
def get_etcd_instance(instance_id):
    """获取指定ETCD实例"""
    try:
        instance = etcd_service.get_instance(instance_id)
        if not instance:
            return jsonify({"error": "ETCD instance not found"}), 404
        return jsonify(instance)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/<int:instance_id>', methods=['PUT'])
@jwt_required()
def update_etcd_instance(instance_id):
    """更新ETCD实例"""
    try:
        data = request.json
        
        # 过滤允许更新的字段
        allowed_fields = ['name', 'host', 'port', 'base_path', 'username', 'password', 
                         'is_active', 'is_default', 'description']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_data:
            return jsonify({"error": "No valid fields to update"}), 400
        
        result = etcd_service.update_instance(instance_id, update_data)
        if not result:
            return jsonify({"error": "ETCD instance not found"}), 404
            
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/<int:instance_id>', methods=['DELETE'])
@jwt_required()
def delete_etcd_instance(instance_id):
    """删除ETCD实例"""
    try:
        success = etcd_service.delete_instance(instance_id)
        if not success:
            return jsonify({"error": "ETCD instance not found"}), 404
            
        return jsonify({"message": "ETCD instance deleted successfully"})
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/<int:instance_id>/test-connection', methods=['POST'])
@jwt_required()
def test_etcd_connection(instance_id):
    """测试ETCD实例连接"""
    try:
        result = etcd_service.test_connection(instance_id)
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/test-connection', methods=['POST'])
@jwt_required()
def test_etcd_connection_generic():
    """测试ETCD连接（通用，不需要实例ID）"""
    try:
        data = request.json or {}
        
        # 验证必需字段
        if not data.get('host') or not data.get('port'):
            return jsonify({"error": "Host and port are required"}), 400
        
        # 使用服务测试连接
        result = etcd_service.test_connection_with_params(
            host=data['host'],
            port=int(data['port']),
            username=data.get('username', ''),
            password=data.get('password', ''),
            base_path=data.get('base_path', '/skydns')
        )
        
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/<int:instance_id>/set-default', methods=['POST'])
@jwt_required()
def set_default_etcd_instance(instance_id):
    """设置默认ETCD实例"""
    try:
        success = etcd_service.set_default_instance(instance_id)
        if not success:
            return jsonify({"error": "ETCD instance not found or not active"}), 404
            
        return jsonify({"message": "Default ETCD instance set successfully"})
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/stats', methods=['GET'])
@jwt_required()
def get_etcd_instances_stats():
    """获取ETCD实例统计信息"""
    try:
        stats = etcd_service.get_instance_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/health-check', methods=['POST'])
@jwt_required()
def health_check_all_instances():
    """检查所有ETCD实例的健康状态"""
    try:
        results = etcd_service.health_check_all()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/<int:instance_id>/health', methods=['GET'])
@jwt_required()
def get_instance_health(instance_id):
    """获取指定实例的健康状态"""
    try:
        instance = etcd_service.get_instance(instance_id)
        if not instance:
            return jsonify({"error": "ETCD instance not found"}), 404
            
        # 获取健康状态
        health_status = etcd_service.test_connection(instance_id)
        return jsonify(health_status)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@etcd_bp.route('/api/etcd-instances/health/all', methods=['GET'])
@jwt_required()
def get_all_instances_health():
    """获取所有实例的健康状态"""
    try:
        from ..services import ConnectionService
        from ..database import DatabaseOperations, DatabaseConnection
        from ..etcd import EtcdConnectionPool
        
        # 获取数据库操作和连接池
        db_conn = DatabaseConnection()
        db_operations = DatabaseOperations(db_conn)
        connection_pool = EtcdConnectionPool()
        
        connection_service = ConnectionService(db_operations, connection_pool)
        result = connection_service.get_all_instances_health_status()
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
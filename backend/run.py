import os
import json
import re
import ipaddress
import time
import hashlib
from datetime import datetime, timedelta
from functools import lru_cache

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

# 导入模块
from modules.database import DatabaseConnection, DatabaseOperations
from modules.etcd import EtcdConnectionPool
from modules.services import EtcdInstanceService, DomainService, DnsService, ConnectionService
from modules.api import etcd_bp, domain_bp, dns_bp
from modules.api.etcd_routes import init_etcd_routes
from modules.api.domain_routes import init_domain_routes
from modules.api.dns_routes import init_dns_routes

# 创建Flask应用
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "allow_headers": ["Content-Type", "Authorization"], "expose_headers": ["Authorization"]}})

# JWT配置
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'be148cd80df035617ca6ea879e8e03f2b32b38256463602635a3d7c0d0286d0e') # openssl rand -hex 32
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_EXPIRATION_HOURS', 24)))

jwt = JWTManager(app)

# 管理员账户配置
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@example.com')
ADMIN_NAME = os.getenv('ADMIN_NAME', 'Administrator')

# 初始化数据库
db_connection = DatabaseConnection()
db_operations = DatabaseOperations(db_connection)

# 初始化连接池
connection_pool = EtcdConnectionPool(max_connections=10)

# 初始化服务
etcd_instance_service = EtcdInstanceService(db_operations, connection_pool)
domain_service = DomainService(db_operations, connection_pool)
dns_service = DnsService(db_operations, connection_pool)
connection_service = ConnectionService(db_operations, connection_pool)

# 初始化API路由
init_etcd_routes(db_operations, connection_pool)
init_domain_routes(db_operations, connection_pool)
init_dns_routes(db_operations, connection_pool)

# 注册蓝图
app.register_blueprint(etcd_bp)
app.register_blueprint(domain_bp)
app.register_blueprint(dns_bp)

# 在应用启动时创建数据库表
with app.app_context():
    try:
        db_connection.create_tables()
        app.logger.info("Database tables created successfully")
    except Exception as e:
        app.logger.error(f"Failed to create database tables: {e}")

# 认证相关API端点
@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录API"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        
        # 验证用户名和密码
        if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
            return jsonify({"error": "Invalid username or password"}), 401
        
        # 创建用户数据
        user_data = {
            "username": ADMIN_USERNAME,
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "role": ["admin"]
        }
        
        # 创建访问令牌
        access_token = create_access_token(identity=ADMIN_USERNAME)
        
        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "user": user_data
        }), 200
        
    except Exception as e:
        app.logger.error(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """获取当前用户信息"""
    try:
        current_user = get_jwt_identity()
        
        if current_user != ADMIN_USERNAME:
            return jsonify({"error": "Invalid user"}), 401
        
        user_data = {
            "username": ADMIN_USERNAME,
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "role": ["admin"]
        }
        
        return jsonify({"user": user_data}), 200
        
    except Exception as e:
        app.logger.error(f"Get user error: {e}")
        return jsonify({"error": "Failed to get user information"}), 500

@app.route('/api/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """修改密码API"""
    try:
        current_user = get_jwt_identity()
        
        if current_user != ADMIN_USERNAME:
            return jsonify({"error": "Invalid user"}), 401
        
        data = request.json
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        if not old_password or not new_password:
            return jsonify({"error": "Old password and new password are required"}), 400
        
        # 验证新密码强度
        if len(new_password) < 6:
            return jsonify({"error": "New password must be at least 6 characters long"}), 400
        
        # 验证旧密码
        global ADMIN_PASSWORD
        if old_password != ADMIN_PASSWORD:
            return jsonify({"error": "Current password is incorrect"}), 400
        
        # 更新密码（注意：这只是运行时更新，不会持久化到环境变量）
        ADMIN_PASSWORD = new_password
        
        return jsonify({
            "message": "Password changed successfully",
            "note": "Password change is temporary and will reset on server restart"
        }), 200
        
    except Exception as e:
        app.logger.error(f"Change password error: {e}")
        return jsonify({"error": "Failed to change password"}), 500

@app.route('/api/auth/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """验证JWT令牌有效性"""
    try:
        current_user = get_jwt_identity()
        return jsonify({
            "valid": True,
            "user": current_user
        }), 200
    except Exception as e:
        return jsonify({
            "valid": False,
            "error": str(e)
        }), 401

# 配置相关API端点
@app.route('/api/config/etcd-base-path', methods=['GET'])
def get_etcd_base_path():
    """获取当前ETCD基础路径配置"""
    try:
        # 获取当前实例
        current_instance = connection_service.get_current_instance()
        if current_instance:
            base_path = current_instance.get('base_path', '/skydns')
        else:
            base_path = '/skydns'
        
        return jsonify({"base_path": base_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/config/etcd-base-path', methods=['POST'])
def set_etcd_base_path():
    """设置ETCD基础路径配置"""
    try:
        data = request.json
        new_base_path = data.get('base_path')
        
        if not new_base_path or not new_base_path.startswith('/'):
            return jsonify({"error": "Invalid base path. Must start with /"}), 400
        
        # 更新当前实例的base_path
        current_instance = connection_service.get_current_instance()
        if current_instance:
            etcd_instance_service.update_instance(
                current_instance['id'], 
                {'base_path': new_base_path}
            )
        
        return jsonify({
            "message": "Base path updated successfully",
            "base_path": new_base_path
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 兼容旧API的端点
@app.route('/api/domains', methods=['GET'])
def get_domains_compat():
    """兼容旧API的域名获取"""
    try:
        # 使用当前实例
        current_instance = connection_service.get_current_instance()
        if not current_instance:
            return jsonify({"error": "No active ETCD instance available"}), 400
            
        instance_id = current_instance['id']
        
        # 获取参数
        base_path = request.args.get('base_path', current_instance.get('base_path', '/skydns'))
        show_virtual = request.args.get('show_virtual', 'false').lower() == 'true'
        
        # 使用域名服务获取域名
        domains = domain_service.get_domains(
            instance_id=instance_id,
            custom_base_path=base_path,
            show_virtual=show_virtual
        )
        
        return jsonify(domains)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/dns-records', methods=['GET'])
def get_dns_records_compat():
    """兼容旧API的DNS记录获取"""
    try:
        # 使用当前实例
        current_instance = connection_service.get_current_instance()
        if not current_instance:
            return jsonify({"error": "No active ETCD instance available"}), 400
            
        instance_id = current_instance['id']
        
        # 获取参数
        filter_domain = request.args.get('domain')
        base_path = request.args.get('base_path', current_instance.get('base_path', '/skydns'))
        
        # 使用DNS服务获取记录
        records = dns_service.get_dns_records(
            instance_id=instance_id,
            filter_domain=filter_domain,
            custom_base_path=base_path
        )
        
        return jsonify(records)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 错误处理
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    import uvicorn

    port = int(os.environ.get('PORT', 55000))
    print(f"CoreDNS Admin Backend Starting...")
    print(f"Default Credentials:")
    print(f"  Username: {ADMIN_USERNAME}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print(f"API Documentation: http://localhost:{port}/api/auth/*")

    uvicorn.run(app, host='0.0.0.0', port=port, log_level='info', interface='wsgi')


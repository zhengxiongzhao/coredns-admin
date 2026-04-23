from flask import Blueprint, request, jsonify
from datetime import datetime
import json
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services import DomainService, ConnectionService
from ..database import DatabaseOperations, DatabaseConnection
from ..etcd import EtcdConnectionPool

# 创建蓝图
domain_bp = Blueprint('domain', __name__)

# 初始化服务（将在应用初始化时设置）
domain_service = None
connection_service = None
db_operations = None

def init_domain_routes(database_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
    """初始化域名路由"""
    global domain_service, connection_service, db_operations
    domain_service = DomainService(database_operations, connection_pool)
    connection_service = ConnectionService(database_operations, connection_pool)
    db_operations = database_operations

@domain_bp.route('/api/domains', methods=['GET'])
@jwt_required()
def get_domains():
    """获取所有域名（从所有活跃的ETCD实例）"""
    try:
        # 获取参数
        custom_base_path = request.args.get('base_path', '/skydns')
        show_virtual = request.args.get('show_virtual', 'false').lower() == 'true'
        
        # 获取所有活跃的ETCD实例
        active_instances = db_operations.get_etcd_instances(active_only=True)
        
        if not active_instances:
            return jsonify([])  # 如果没有活跃实例，返回空列表
        
        all_domains = []
        
        # 从每个活跃实例获取域名
        for instance in active_instances:
            try:
                # 获取实例的ETCD客户端
                instance_config = {
                    'host': instance.host,
                    'port': instance.port,
                    'base_path': instance.base_path,
                    'username': instance.username,
                    'password': instance.password
                }
                etcd_client = connection_service.connection_pool.get_connection(instance.id, instance_config)
                if not etcd_client:
                    continue
                
                # 获取所有DNS记录
                all_records = []
                try:
                    etcd_records = etcd_client.get_prefix(custom_base_path)
                    for value, metadata in etcd_records:
                        all_records.append((value, metadata))
                except Exception as e:
                    from flask import current_app
                    current_app.logger.warning(f"Could not fetch DNS records from instance {instance.id}: {e}")
                    continue
                
                # 获取所有Domain标记
                domain_marks_prefix = '/coredns-admin/domain-marks'
                marks = {}
                virtual_domains = {}
                
                try:
                    marks_iter = etcd_client.get_prefix(domain_marks_prefix)
                    for value, metadata in marks_iter:
                        try:
                            key_str = metadata.key.decode('utf-8')
                            value_data = json.loads(value.decode('utf-8'))
                            
                            if value_data.get('is_marked_as_domain'):
                                # 从key中提取path
                                key_parts = key_str.split('/')
                                if len(key_parts) >= 5:
                                    space = '/' + '/'.join(key_parts[3:-1])
                                    domain_path = key_parts[-1]
                                    path = f"{space}/{domain_path}"
                                    marks[path] = value_data
                        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
                            continue
                except Exception as e:
                    from flask import current_app
                    current_app.logger.warning(f"Could not fetch domain marks from instance {instance.id}: {e}")
                
                # 从记录中提取域名
                domains = {}
                marked_domains = set()
                for mark_data in marks.values():
                    marked_domain = mark_data.get('domain')
                    if marked_domain:
                        marked_domains.add(marked_domain)
                
                # 处理所有记录
                for value, metadata in all_records:
                    try:
                        key_str = metadata.key.decode('utf-8')
                        
                        # 确保我们处理的是DNS记录
                        try:
                            record_data = json.loads(value.decode('utf-8'))
                            if record_data.get('virtual'):
                                continue
                            
                            # 检查是否是有效的DNS记录或虚拟域名记录
                            is_valid_dns_record = any(key in record_data for key in ['host', 'text', 'priority', 'target', 'ns'])
                            is_virtual_domain = 'created' in record_data and len(record_data) == 1
                            
                            if not is_valid_dns_record and not is_virtual_domain:
                                continue
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            continue

                        # 提取域名 - 使用第二级域名
                        full_domain = connection_service.etcd_key_to_domain(key_str, custom_base_path)
                        second_level_domain = connection_service.extract_second_level_domain(full_domain)
                        
                        # 检查该域名是否被手动标记
                        is_marked = second_level_domain in marked_domains
                        
                        # 确定是否是虚拟域名
                        has_dns_content = any(key in record_data for key in ['host', 'text', 'priority', 'target', 'ns'])
                        has_created_only = 'created' in record_data and len(record_data) == 1
                        is_virtual = not has_dns_content and not has_created_only
                        
                        # 添加到域名列表
                        if second_level_domain not in domains:
                            domains[second_level_domain] = {
                                "domain": second_level_domain,
                                "space": custom_base_path,
                                "path": key_str,
                                "is_marked_as_domain": is_marked,
                                "is_virtual": is_virtual,
                                "record_count": 1 if not is_virtual else 0
                            }
                        else:
                            if not is_virtual:
                                domains[second_level_domain]["record_count"] += 1
                    except Exception as e:
                        from flask import current_app
                        current_app.logger.warning(f"Error processing record {key_str}: {e}")
                        continue
                
                # 根据显示模式过滤域名
                result = []
                
                if show_virtual:
                    # 操作显示模式：显示所有相关域名
                    # 1. 添加所有第二级域名（有实际记录的）
                    for domain_info in domains.values():
                        result.append(domain_info)
                    
                    # 2. 从所有记录中提取分支节点
                    branch_nodes = set()
                    for value, metadata in all_records:
                        try:
                            key_str = metadata.key.decode('utf-8')
                            full_domain = connection_service.etcd_key_to_domain(key_str, custom_base_path)
                            
                            # 只提取分支节点（第二级以下的中间节点）
                            parts = full_domain.split('.')
                            
                            # 对于多级域名，提取所有中间分支节点
                            if len(parts) > 2:
                                for i in range(1, len(parts)-1):  # 不包含最后一级（叶子节点）
                                    branch_domain = '.'.join(parts[i:])
                                    if len(branch_domain.split('.')) >= 2:  # 至少两级
                                        branch_nodes.add(branch_domain)
                            
                            # 特别处理：如果完整域名本身是多级的，提取其直接父域名作为分支
                            if len(full_domain.split('.')) > 2:
                                parent_parts = full_domain.split('.')[1:]  # 移除第一级，得到父域名
                                parent_domain = '.'.join(parent_parts)
                                if len(parent_domain.split('.')) >= 2:
                                    branch_nodes.add(parent_domain)
                                
                        except Exception as e:
                            from flask import current_app
                            current_app.logger.warning(f"提取分支节点时出错: {e}")
                            continue
                    
                    # 3. 添加有实际记录的分支节点
                    for branch_domain in branch_nodes:
                        # 检查是否已经在结果中
                        already_exists = any(d['domain'] == branch_domain for d in result)
                        if not already_exists:
                            # 检查这个分支节点是否被标记
                            is_branch_marked = branch_domain in marked_domains
                            result.append({
                                "domain": branch_domain,
                                "space": custom_base_path,
                                "path": connection_service.domain_to_etcd_key(branch_domain, custom_base_path),
                                "is_marked_as_domain": is_branch_marked,
                                "is_virtual": True,
                                "record_count": 1
                            })
                    
                    # 4. 添加所有手动标记的域名
                    for mark_path, mark_data in marks.items():
                        marked_domain = mark_data.get('domain')
                        already_exists = any(d['domain'] == marked_domain for d in result)
                        if not already_exists:
                            result.append({
                                "domain": marked_domain,
                                "space": mark_data.get('space', '/skydns'),
                                "path": mark_path,
                                "is_marked_as_domain": True,
                                "is_virtual": True,
                                "record_count": 0
                            })
                else:
                    # 默认隐藏模式
                    # 获取所有标记的域名
                    marked_domains_set = set()
                    for mark_data in marks.values():
                        marked_domain = mark_data.get('domain')
                        if marked_domain:
                            marked_domains_set.add(marked_domain)
                    
                    # 按第二级域名分组检查标记
                    second_level_groups = {}
                    for mark_data in marks.values():
                        marked_domain = mark_data.get('domain')
                        if marked_domain:
                            second_level = connection_service.extract_second_level_domain(marked_domain)
                            if second_level not in second_level_groups:
                                second_level_groups[second_level] = []
                            second_level_groups[second_level].append(marked_domain)
                    
                    # 收集要显示的域名
                    domains_to_show = []
                    
                    # 1. 首先处理有实际记录的域名
                    for domain_info in domains.values():
                        second_level = connection_service.extract_second_level_domain(domain_info['domain'])
                        
                        # 如果这个第二级域名组有标记，跳过（不显示第二级域名）
                        if second_level in second_level_groups:
                            continue
                        
                        # 更新第二级域名的标记状态
                        if second_level in marked_domains_set:
                            domain_info['is_marked_as_domain'] = True
                        
                        # 如果没有标记，显示第二级域名
                        domains_to_show.append(domain_info)
                    
                    # 2. 然后添加所有标记的域名
                    for mark_path, mark_data in marks.items():
                        marked_domain = mark_data.get('domain')
                        domains_to_show.append({
                            "domain": marked_domain,
                            "space": mark_data.get('space', '/skydns'),
                            "path": mark_path,
                            "is_marked_as_domain": True,
                            "is_virtual": False,
                            "record_count": 0
                        })
                    
                    result = domains_to_show
                
                # 为每个域名添加实例信息
                for domain in result:
                    domain_with_instance = {
                        **domain,
                        'instance_id': instance.id,
                        'instance_name': instance.name,
                        'instance_host': instance.host,
                        'instance_port': instance.port,
                        'instance_base_path': instance.base_path
                    }
                    all_domains.append(domain_with_instance)
                    
            except Exception as e:
                # 记录错误但继续处理其他实例
                from flask import current_app
                current_app.logger.warning(f"Failed to get domains from instance {instance.id} ({instance.name}): {str(e)}")
                continue
        
        return jsonify(all_domains)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@domain_bp.route('/api/domains', methods=['POST'])
@jwt_required()
def create_domain():
    """创建域名"""
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
        if 'domain' not in data:
            return jsonify({"error": "Domain name is required"}), 400
        
        domain_data = {
            'domain': data['domain'],
            'base_path': data.get('base_path')
        }
        
        result = domain_service.create_domain(instance_id, domain_data)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@domain_bp.route('/api/domains/<path:domain>', methods=['DELETE'])
@jwt_required()
def delete_domain(domain):
    """删除域名"""
    try:
        # 获取实例ID参数
        instance_id = request.args.get('instance_id', type=int)
        if not instance_id:
            # 如果没有指定实例ID，使用当前实例
            current_instance = connection_service.get_current_instance()
            if not current_instance:
                return jsonify({"error": "No active ETCD instance available"}), 400
            instance_id = current_instance['id']
        
        # 获取其他参数
        custom_base_path = request.args.get('base_path')
        
        result = domain_service.delete_domain(
            instance_id=instance_id,
            domain=domain,
            custom_base_path=custom_base_path
        )
        
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@domain_bp.route('/api/domains/mark', methods=['POST'])
@jwt_required()
def mark_domain():
    """标记/取消标记域名为Domain"""
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
        if 'domain' not in data:
            return jsonify({"error": "Domain name is required"}), 400
        
        domain = data['domain']
        mark = data.get('mark', True)
        custom_base_path = data.get('base_path')
        
        result = domain_service.mark_domain(
            instance_id=instance_id,
            domain=domain,
            mark=mark,
            custom_base_path=custom_base_path
        )
        
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@domain_bp.route('/api/etcd-instances/<int:instance_id>/domains', methods=['GET'])
@jwt_required()
def get_instance_domains(instance_id):
    """获取指定ETCD实例的域名"""
    try:
        # 获取参数
        custom_base_path = request.args.get('base_path')
        show_virtual = request.args.get('show_virtual', 'false').lower() == 'true'
        
        domains = domain_service.get_domains(
            instance_id=instance_id,
            custom_base_path=custom_base_path,
            show_virtual=show_virtual
        )
        
        return jsonify(domains)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@domain_bp.route('/api/etcd-instances/<int:instance_id>/domains', methods=['POST'])
@jwt_required()
def create_instance_domain(instance_id):
    """在指定ETCD实例上创建域名"""
    try:
        data = request.json
        
        # 验证必需字段
        if 'domain' not in data:
            return jsonify({"error": "Domain name is required"}), 400
        
        domain_data = {
            'domain': data['domain'],
            'base_path': data.get('base_path')
        }
        
        result = domain_service.create_domain(instance_id, domain_data)
        return jsonify(result), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@domain_bp.route('/api/etcd-instances/<int:instance_id>/domains/<path:domain>', methods=['DELETE'])
@jwt_required()
def delete_instance_domain(instance_id, domain):
    """删除指定ETCD实例上的域名"""
    try:
        # 获取参数
        custom_base_path = request.args.get('base_path')
        
        result = domain_service.delete_domain(
            instance_id=instance_id,
            domain=domain,
            custom_base_path=custom_base_path
        )
        
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
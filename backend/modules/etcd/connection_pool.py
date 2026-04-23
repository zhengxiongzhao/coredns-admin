from typing import Dict, Optional, Any, List
from datetime import datetime
from .client import EtcdClient
from .exceptions import EtcdConnectionError

class EtcdConnectionPool:
    """ETCD连接池管理器"""
    
    def __init__(self, max_connections: int = 10):
        self.connections: Dict[int, EtcdClient] = {}
        self.connection_configs: Dict[int, Dict[str, Any]] = {}
        self.max_connections = max_connections
        self.connection_stats: Dict[int, Dict[str, Any]] = {}
        
    def get_connection(self, instance_id: int, instance_config: Dict[str, Any]) -> EtcdClient:
        """获取ETCD连接"""
        # 检查是否已有活跃连接
        if instance_id in self.connections:
            client = self.connections[instance_id]
            if client.health_check():
                # 更新最后使用时间
                self._update_connection_stats(instance_id, 'last_used', datetime.utcnow())
                return client
            else:
                # 连接已失效，移除并重新创建
                self.remove_connection(instance_id)
                
        # 检查连接数限制
        if len(self.connections) >= self.max_connections:
            # 移除最久未使用的连接
            self._remove_oldest_connection()
            
        # 创建新连接
        client = self._create_connection(instance_config)
        self.connections[instance_id] = client
        self.connection_configs[instance_id] = instance_config
        self._update_connection_stats(instance_id, 'created_at', datetime.utcnow())
        self._update_connection_stats(instance_id, 'last_used', datetime.utcnow())
        
        return client
        
    def _create_connection(self, config: Dict[str, Any]) -> EtcdClient:
        """创建ETCD连接"""
        try:
            return EtcdClient(
                host=config['host'],
                port=config['port'],
                base_path=config.get('base_path', '/skydns'),
                username=config.get('username'),
                password=config.get('password')
            )
        except Exception as e:
            raise EtcdConnectionError(f"Failed to create ETCD connection: {str(e)}")
            
    def remove_connection(self, instance_id: int):
        """移除ETCD连接"""
        if instance_id in self.connections:
            del self.connections[instance_id]
        if instance_id in self.connection_configs:
            del self.connection_configs[instance_id]
        if instance_id in self.connection_stats:
            del self.connection_stats[instance_id]
            
    def _remove_oldest_connection(self):
        """移除最久未使用的连接"""
        if not self.connection_stats:
            return
            
        oldest_id = min(self.connection_stats.keys(), 
                       key=lambda x: self.connection_stats[x].get('last_used', datetime.min))
        self.remove_connection(oldest_id)
        
    def health_check_all(self) -> Dict[int, bool]:
        """检查所有连接的健康状态"""
        results = {}
        failed_connections = []
        
        for instance_id, client in self.connections.items():
            try:
                is_healthy = client.health_check()
                results[instance_id] = is_healthy
                self._update_connection_stats(instance_id, 'last_check', datetime.utcnow())
                self._update_connection_stats(instance_id, 'health_status', 'healthy' if is_healthy else 'unhealthy')
                
                if not is_healthy:
                    failed_connections.append(instance_id)
            except Exception as e:
                results[instance_id] = False
                self._update_connection_stats(instance_id, 'health_status', 'error')
                self._update_connection_stats(instance_id, 'last_error', str(e))
                failed_connections.append(instance_id)
                
        # 移除失败的连接
        for instance_id in failed_connections:
            self.remove_connection(instance_id)
            
        return results
        
    def get_connection_stats(self) -> Dict[str, Any]:
        """获取连接池统计信息"""
        return {
            'total_connections': len(self.connections),
            'max_connections': self.max_connections,
            'connection_ids': list(self.connections.keys()),
            'connection_stats': self.connection_stats.copy()
        }
        
    def _update_connection_stats(self, instance_id: int, key: str, value: Any):
        """更新连接统计信息"""
        if instance_id not in self.connection_stats:
            self.connection_stats[instance_id] = {}
        self.connection_stats[instance_id][key] = value
        
    def close_all_connections(self):
        """关闭所有连接"""
        for instance_id in list(self.connections.keys()):
            self.remove_connection(instance_id)
            
    def get_connection_config(self, instance_id: int) -> Optional[Dict[str, Any]]:
        """获取连接配置"""
        return self.connection_configs.get(instance_id)
        
    def is_connection_active(self, instance_id: int) -> bool:
        """检查连接是否活跃"""
        if instance_id not in self.connections:
            return False
        return self.connections[instance_id].health_check()
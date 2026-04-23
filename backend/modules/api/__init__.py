# API modules
from .etcd_routes import etcd_bp
from .domain_routes import domain_bp
from .dns_routes import dns_bp

__all__ = ['etcd_bp', 'domain_bp', 'dns_bp']
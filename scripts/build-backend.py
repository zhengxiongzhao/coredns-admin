#!/usr/bin/env python3
"""
Build Flask backend as a standalone executable using PyInstaller.
The output binary is placed in frontend/src-tauri/binaries/ with the
Tauri sidecar naming convention: <name>-<target-triple>
"""

import os
import platform
import subprocess
import sys
import shutil
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
TAURI_BINARIES_DIR = PROJECT_ROOT / "frontend" / "src-tauri" / "binaries"

SIDECAR_NAME = "coredns-admin-backend"


def get_target_triple() -> str:
    """Get the Rust target triple for the current platform."""
    machine = platform.machine().lower()
    system = platform.system().lower()

    if system == "darwin":
        arch = "aarch64" if machine == "arm64" else "x86_64"
        return f"{arch}-apple-darwin"
    elif system == "linux":
        arch = "x86_64" if machine in ("x86_64", "amd64") else "aarch64"
        return f"{arch}-unknown-linux-gnu"
    elif system == "windows":
        arch = "x86_64" if machine in ("x86_64", "amd64") else "aarch64"
        return f"{arch}-pc-windows-msvc"
    else:
        raise RuntimeError(f"Unsupported platform: {system} {machine}")


def build_backend():
    """Build the Flask backend with PyInstaller."""
    target_triple = get_target_triple()
    system = platform.system().lower()

    # Output filename follows Tauri sidecar convention
    ext = ".exe" if system == "windows" else ""
    output_name = f"{SIDECAR_NAME}-{target_triple}{ext}"

    print(f"Building backend for: {target_triple}")
    print(f"Output: {TAURI_BINARIES_DIR / output_name}")

    # Ensure output directory exists
    TAURI_BINARIES_DIR.mkdir(parents=True, exist_ok=True)

    # PyInstaller command
    pyinstaller_args = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", SIDECAR_NAME,
        "--distpath", str(TAURI_BINARIES_DIR),
        "--workpath", str(PROJECT_ROOT / "build" / "pyinstaller"),
        "--specpath", str(PROJECT_ROOT / "build"),
        # Add backend modules
        "--paths", str(BACKEND_DIR),
        # Hidden imports for Flask and dependencies
        "--hidden-import", "flask",
        "--hidden-import", "flask_cors",
        "--hidden-import", "flask_jwt_extended",
        "--hidden-import", "sqlalchemy",
        "--hidden-import", "etcd3",
        "--hidden-import", "grpc",
        "--hidden-import", "google.protobuf",
        # Uvicorn
        "--collect-all", "uvicorn",
        # etcd3 + protobuf
        "--collect-all", "etcd3",
        "--collect-all", "google.protobuf",
        # Entry point
        str(BACKEND_DIR / "run.py"),
    ]

    print(f"Running: {' '.join(pyinstaller_args)}")
    result = subprocess.run(pyinstaller_args, cwd=str(PROJECT_ROOT))

    if result.returncode != 0:
        print("ERROR: PyInstaller build failed!")
        sys.exit(1)

    # Rename output to match Tauri sidecar naming
    built_file = TAURI_BINARIES_DIR / f"{SIDECAR_NAME}{ext}"
    target_file = TAURI_BINARIES_DIR / output_name

    if built_file.exists() and built_file != target_file:
        shutil.move(str(built_file), str(target_file))

    if target_file.exists():
        # Make executable on Unix
        if system != "windows":
            os.chmod(str(target_file), 0o755)
        print(f"SUCCESS: Built {target_file}")
        print(f"  Size: {target_file.stat().st_size / 1024 / 1024:.1f} MB")
    else:
        print(f"ERROR: Expected output not found: {target_file}")
        sys.exit(1)


if __name__ == "__main__":
    build_backend()

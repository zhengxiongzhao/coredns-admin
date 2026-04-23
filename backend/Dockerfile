FROM python:3.11-slim

# Install build dependencies for libsql-experimental
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    curl \
    pkg-config \
    libssl-dev \
    cmake \
    make \
    && rm -rf /var/lib/apt/lists/*

# Install Rust for libsql-experimental
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
ENV PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python

WORKDIR /app
RUN mkdir -p /app/data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 55000

CMD ["python", "run.py"]
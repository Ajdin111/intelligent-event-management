# Base image - Python 3.13 slim keeps the image small
FROM python:3.13-slim

# Set working directory inside the container
WORKDIR /app

# Set environment variables
# Prevents Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
# Prevents Python from buffering stdout/stderr (important for logs)
ENV PYTHONUNBUFFERED=1

# Install system dependencies needed by some Python packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libpq-dev \
    libopenblas-dev \
    pkg-config \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first
# This is done before copying the code so Docker can cache this layer
# If requirements.txt hasn't changed, Docker skips this step on rebuild
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# In development we do NOT copy the code here
# The code is mounted as a volume from the host machine
# This means changes to the code are reflected instantly without rebuilding

# Expose the port FastAPI runs on
EXPOSE 8000

# Start the FastAPI app with hot reload enabled for development
CMD ["bash", "start.sh"]

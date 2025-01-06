# Base stage
FROM python:3.12 AS base
WORKDIR /pyspur/backend
COPY requirements.txt .
RUN pip install -r requirements.txt

# Development stage
FROM base AS development
# Development-specific instructions here

# Production stage
FROM base AS production
COPY . .
# Production-specific instructions here

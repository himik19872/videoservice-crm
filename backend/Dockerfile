FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create entrypoint script
RUN echo '#!/bin/bash\npython manage.py migrate\npython manage.py loaddata regions.json\npython manage.py loaddata users.json\npython manage.py loaddata masters.json\npython manage.py loaddata user_profiles.json\npython manage.py runserver 0.0.0.0:8000' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

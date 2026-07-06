FROM pytorch/pytorch:2.1.2-cuda11.8-cudnn8-runtime

# System deps required by opencv-python-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# /app/src  — source code (this image's context)
# /app/weights — mounted at runtime from host ./ml/weights
WORKDIR /app/src

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_ENV=production

EXPOSE 5001

# gunicorn imports app:app without triggering the interactive CLI main()
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5001", \
     "--workers", "1", \
     "--timeout", "600", \
     "--preload", \
     "app:app"]

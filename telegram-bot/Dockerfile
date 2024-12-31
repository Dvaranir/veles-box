# Use the official Python image from the Docker Hub
FROM python:3.12-slim

# Install cron
RUN apt-get update && apt-get install -y zip curl nano cron ffmpeg

# Set nano as the default editor for cron
RUN echo "export VISUAL=nano" >> /etc/environment && echo "export EDITOR=nano" >> /etc/environment

# Set the working directory
WORKDIR /bot

# Copy the requirements file into the container
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

CMD ["python", "main.py"]


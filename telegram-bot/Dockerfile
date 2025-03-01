# Use the official Python image from the Docker Hub
FROM python:3.12-slim

# Install cron
RUN apt-get update && apt-get install -y zip curl nano cron ffmpeg bash

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

RUN mkdir -p ./log/cron

# Create startup script that exports environment variables for cron
RUN echo '#!/bin/bash\n\
# Export environment variables to a file that will be sourced by cron jobs\n\
env | grep -v "no_proxy" > /etc/environment\n\
service cron start\n\
python main.py' > /bot/start.sh
RUN chmod +x /bot/start.sh

# Modify the backup script to source environment variables
RUN echo '#!/bin/bash\n\
# Source environment variables\n\
source /etc/environment\n\
# Run the original backup script with environment loaded\n\
/bot/backup_to_pixeldrain.sh.original' > /bot/backup_wrapper.sh
RUN chmod +x /bot/backup_wrapper.sh

# Rename the original script
RUN if [ -f /bot/backup_to_pixeldrain.sh ]; then mv /bot/backup_to_pixeldrain.sh /bot/backup_to_pixeldrain.sh.original; fi
RUN chmod +x /bot/backup_to_pixeldrain.sh.original

# Create cron job file and set proper permissions
RUN echo "0 0 */14 * * /bin/bash /bot/backup_wrapper.sh >> /bot/log/cron/backup.log 2>&1" > /etc/cron.d/backup-cron

# Add newline at end of file (required for cron)
RUN echo "" >> /etc/cron.d/backup-cron

RUN chmod 0644 /etc/cron.d/backup-cron
RUN crontab /etc/cron.d/backup-cron

# Use the startup script as the entry point
CMD ["/bin/bash", "/bot/start.sh"]


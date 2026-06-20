#!/bin/sh
set -eu

# Cron does not inherit the container environment. The wrapper reads this file
# before invoking the existing PixelDrain backup script.
env | grep -v '^no_proxy=' > /etc/environment
cron

exec node src/index.js

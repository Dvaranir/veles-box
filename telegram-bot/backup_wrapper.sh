#!/bin/sh
set -eu

if [ -f /etc/environment ]; then
  set -a
  . /etc/environment
  set +a
fi

exec /usr/local/bin/backup_to_pixeldrain.sh

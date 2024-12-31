#!/bin/bash

if [ -z "$PIXELDRAIN_TOKEN" ]; then
    echo "PIXELDRAIN_TOKEN is not set. Exiting."
    exit 1
fi

LOCATION="/"
FOLDER_NAME="project"

DATE=$(date +%Y-%m-%d)

ARCHIVE_NAME="${FOLDER_NAME}-${DATE}.zip"

zip -P "0(9x'_cTQ=%1VZ5cjJ,%ayb$x" -r9 "$LOCATION$ARCHIVE_NAME" "$LOCATION$FOLDER_NAME"

RESPONSE=$(curl -T "$LOCATION$ARCHIVE_NAME" -u :$PIXELDRAIN_TOKEN "https://pixeldrain.com/api/file/")

echo $RESPONSE

rm "$LOCATION$ARCHIVE_NAME"

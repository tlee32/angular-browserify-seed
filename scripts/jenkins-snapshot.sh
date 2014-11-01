#!/bin/sh

echo "Downloading node modules..."
npm install

echo "Starting grunt tasks..."
eval grunt -v snapshot
if [ $? != 0 ]; then
    echo "grunt task: snapshot failed, exiting..."
	exit 1
fi
# For some reason, can't have tasks after package
    # They don't run...
eval grunt -v snapshot-push
if [ $? != 0 ]; then
    echo "grunt task: snapshot-push failed, exiting..."
	exit 1
fi

echo "all done"

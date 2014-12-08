#!/bin/sh

echo "Downloading node modules..."
npm install

echo "Starting grunt tasks..."
eval grunt -v snapshot --git=$GIT_COMMIT
if [ $? != 0 ]; then
    echo "grunt task: snapshot failed, exiting..."
	exit 1
fi

echo "all done"

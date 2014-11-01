#!/bin/sh

echo "checkout revision $git_revision"
if [ -z "$git_revision" ]; then
    echo "git_revision is empty"
    exit 1
fi

eval git checkout $git_revision
if [ $? != 0 ]; then
    echo "unable to checkout revision $git_revision  exiting..."
	exit 1
fi

echo "Downloading node modules..."
npm install

echo "Starting grunt tasks..."
eval grunt -v release
if [ $? != 0 ]; then
    echo "grunt task: release failed, exiting..."
	exit 1
fi
# For some reason, can't have tasks after package
    # They don't run...
eval grunt -v release-tag-push
if [ $? != 0 ]; then
    echo "grunt task: release-tag-push failed, exiting..."
	exit 1
fi

echo "all done"
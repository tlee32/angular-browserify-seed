#!/bin/sh

echo "Downloading node modules..."
npm install

echo "Starting grunt tasks..."
grunt jenkins

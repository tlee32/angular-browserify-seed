#!/bin/sh

echo Installing node modules...
npm install
echo Done.
echo Installing node modules for the APIclient...
cd lib/APIclient
npm install
echo Done.
cd ../../
echo Setup done.
echo ========================================================
echo "\n To run the app locally, use the command: \n\n grunt localhost\n"

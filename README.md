## Skeleton App for Angular Apps
This seed project includes the container API and an API client to converse with the cloud.

### Setup
1. Clone this repo
2. Install global node modules (grunt and testem):
<br>`sudo npm install -g grunt`
<br>`sudo npm install -g testem`
3. Download all the node modules needed for development:
<br>`sh setup.sh`
4. To run the app locally
(Note: this will also watch for changes to *.js, *.html, and
 *.less files in src and automatically
 re-build the project with the new changes):
<br>`grunt localhost`
5. To start the test runner:
<br>`testem`
<br> OR
<br>`grunt test`

### Testing
[Testem test runner](https://github.com/airportyh/testem) and [Browserify](http://browserify.org/) is used to test this
seed project.

Before the tests are run, browserify bundles all the files listed in tests/entry.js
(which should include the source file and the test files) and all the files listed
in tests/dependencies.js (which should include dependencies needed to run the tests
- ex. angular-mocks) browserified.js. Testem then runs the tests specified in browserified.js.
When you exit Testem, it will delete browserified.js.

#### Add test files
1. Include all the test files you want testem to test in tests/entry.js using Browserify's require method.
2. Use the command `testem` in the root of this directory to run the tests.

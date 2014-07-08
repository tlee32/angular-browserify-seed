## Skeleton App for Angular Apps
This seed project includes the container API and an API client to converse with the cloud.

### Setup
1. Clone this repo
2. Download all the node modules needed for development:
`sh script.sh`
3. To run the app locally:`grunt localhost`
4. To run the tests: `grunt test`

### Testing
[Testem test runner](https://github.com/airportyh/testem) and [Browserify](http://browserify.org/) is used to test this
seed project.

Before the tests are run, browserify is used on all the test files to create
browserified.js. Testem then runs the tests specified in browserified.js. When you exit Testem, it will delete
browserified.js.

#### Add test files
1. Include the dependencies of all the test files in tests/entry.js using Browserify's require method.
2. Include all the test files you want testem to test in tests/entry.js using Browserify's require method.
3. Use the command `testem` in the root of this directory to run the tests.

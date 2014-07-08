'use strict';

var feature1Module = angular.module('MyApp.Feature1', []);

// Include all files that depend on this module here:
require('./feature1.ctlr.js');
require('./feature1.factory.js');

module.export = feature1Module;

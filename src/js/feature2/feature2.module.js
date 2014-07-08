'use strict';

var feature2Module = angular.module('MyApp.Feature2', []);

// Include all files that depend on this module here:
require('./feature2.ctlr.js');
require('./feature2.factory.js');

module.export = feature2Module;

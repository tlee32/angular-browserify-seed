'use strict';

require('angular');
require('angular-route');
require('../lib/rbc.js');                                   // TODO: RBC factories?

// Include all modules here:
require('./feature1/feature1.module.js');
require('./feature2/feature2.module.js');

angular.module('MyApp', ['ngRoute', 'MyApp.Feature1', 'MyApp.Feature2'])
    .config(function($routeProvider, $locationProvider) {

        $routeProvider.otherwise({
            templateUrl: 'feature1/feature1.tpl.html',
            controller: 'Feature1Controller'
        });

        $routeProvider.when('/two', {
            templateUrl: 'feature2/feature2.tpl.html',
            controller: 'Feature2Controller'
        });

        // TODO: Add more routes here

        $locationProvider.html5Mode(true);
    })
    .controller('MainController', ['$scope', function($scope) {
        // TODO
    }]);


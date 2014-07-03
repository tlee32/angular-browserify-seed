'use strict';

var angular = require('angular');

var feature1Controller = angular.module('MyApp.Feature1').controller('Feature1Controller',
    ['$scope', '$location', function($scope, $location) {
        $scope.test = 'Hello World';
        $scope.goToFeature2 = function() {
            $location.url('/two');
        }
    }]
);

module.export = feature1Controller;

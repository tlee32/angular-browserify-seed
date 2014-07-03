'use strict';

var angular = require('angular');

var feature2Controller = angular.module('MyApp.Feature2').controller('Feature2Controller',
    ['$scope', function($scope) {
        $scope.test = 'Feature 2';
    }]
);

module.export = feature2Controller;

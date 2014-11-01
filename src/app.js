'use strict';

// Include all modules here:
require('./templates/templates.module.js');
require('./feature1/feature1.module.js');
require('./feature2/feature2.module.js');

angular.module('MyApp', ['ngRoute', 'Templates', 'MyApp.Feature1', 'MyApp.Feature2'])
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

        $locationProvider.html5Mode(false);
    })
    .run(function () {

        window.device.ready(function () {
            window.deviceOrientation.setOrientation(window.deviceOrientation.MODE.PORTRAIT);
            window.navigationBar.hide({ fixed: true });
        });
    })
    .controller('MainController', ['$scope', function($scope) {
        // TODO
    }]);


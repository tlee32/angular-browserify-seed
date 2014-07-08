'use strict';

var feature1Factory = angular.module('MyApp.Feature1')
    .factory('Feature1Factory',
        [
            function() {

                return {
                    method: function(){console.log('hi');}
                };

            }
        ]
    );

module.export = feature1Factory;

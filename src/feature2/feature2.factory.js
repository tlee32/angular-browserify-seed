'use strict';

var feature2Factory = angular.module('MyApp.Feature2')
    .factory('Feature2Factory',
        [
            function() {

                return {
                    method: function(){console.log('hi');}
                };

            }
        ]
    );

module.export = feature2Factory;

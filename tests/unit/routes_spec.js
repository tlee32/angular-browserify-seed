/**
 * Test:
 * - routes map to the correct controllers
 * - routes map to the correct template
 * - routes redirect correctly
 * - route parameters
 */

describe('Routes', function() {
    var route;

    beforeEach(angular.mock.module('MyApp'));
    beforeEach(angular.mock.inject(function($route) {
        route = $route;
    }));

    it('should map routes to controllers', function() {
        expect(route.routes[null].controller).toBe('Feature1Controller');
        expect(route.routes['/two'].controller).toBe('Feature2Controller');
    });

    it('should map routes to partials', function() {
        expect(route.routes[null].templateUrl).toBe('partials/feature1.tpl.html');
        expect(route.routes['/two'].templateUrl).toBe('partials/feature2.tpl.html');
    });

});
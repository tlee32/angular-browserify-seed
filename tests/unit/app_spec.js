/**
 * Test:
 * - App has the required modules to test
 * - App's module exists
 * - App's dependencies exists
 */

describe('App', function() {

    it('should have the required modules for testing', function() {
        expect(angular).toBeDefined();
        expect(angular.module).toBeDefined();
        expect(angular.mock.module).toBeDefined();
    });

    describe('MyApp Module', function() {
        var m;
        beforeEach(m = angular.mock.module('MyApp'));

        it('should have the MyApp module', function() {
            expect(m).toBeDefined();
            expect(m).not.toBe(null);
        });
    });

    describe('dependencies', function() {

        var deps,
            module,
            hasModule = function(m) {
                return deps.indexOf(m) >= 0;
            };

        beforeEach(function() {
            module = angular.module('MyApp');
            deps = module.value('MyApp').requires;
        });

        it('should have MyApp.Feature1 as a dependency', function() {
            expect(hasModule('MyApp.Feature1')).toBeTruthy();
        });

        it('should have MyApp.Feature2 as a dependency', function() {
            expect(hasModule('MyApp.Feature2')).toBeTruthy();
        });
    });

});
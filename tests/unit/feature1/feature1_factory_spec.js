describe('Feature1 Factory', function() {
    var Feature1Factory;

    it('should have the required modules', function() {
        expect(angular).toBeDefined();
        expect(angular.module).toBeDefined();
        expect(angular.mock.module).toBeDefined();
    });

    beforeEach(angular.mock.module('MyApp'));

    beforeEach(angular.mock.inject(function($injector) {
        Feature1Factory = $injector.get('Feature1Factory');
    }));

    it('should have the Feature1Factory', function() {
        expect(Feature1Factory).toBeDefined();
    });

});
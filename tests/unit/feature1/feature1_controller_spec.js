describe('Feature1 Controller', function() {
    var controller, $scope;

    it('should have the required modules', function() {
        expect(angular).toBeDefined();
        expect(angular.module).toBeDefined();
        expect(angular.mock.module).toBeDefined();
    });

    beforeEach(angular.mock.module('MyApp'));

    beforeEach(
        angular.mock.inject(function ($rootScope, $controller) {
            $scope = $rootScope.$new();

            controller = $controller('Feature1Controller', {
                '$scope': $scope
            });
        })
    );

    it('should have the Feature1Controller', function() {

        expect(controller).toBeDefined();
        expect($scope.test).toBe('Hello World');

    });

});
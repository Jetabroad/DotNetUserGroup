(function () {
    'use strict';

    angular.module("directives", [])
        .directive('favoriteList', function () {
            return {
                restrict: 'E',
                controller: FavoritesController,
                scope: {},
                controllerAs: 'control',
                templateUrl: 'directives/favorites-list/favorites-list.html',
            };

            function FavoritesController() {
                this.favorites = ["C#", "AngularJS", "Rocket Ships"];
            }
        }
    );

})();
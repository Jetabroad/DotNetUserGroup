!function() {
    "use strict";
    angular.module("app.about", [ "directives" ]).controller("AboutController", [ function() {
        this.name = "About";
    } ]);
}(), function() {
    "use strict";
    angular.module("app.home", []).controller("HomeController", [ function() {
        this.favorites = [ "C#", "JavaScript", "Angular" ];
    } ]);
}(), function() {
    "use strict";
    angular.module("directives", []).directive("favoriteList", function() {
        function FavoritesController() {
            this.favorites = [ "C#", "AngularJS", "Rocket Ships" ];
        }
        return {
            restrict: "E",
            controller: FavoritesController,
            scope: {},
            controllerAs: "control",
            templateUrl: "directives/favorites-list/favorites-list.html"
        };
    });
}(), function() {
    "use strict";
    function AppController($router) {}
    angular.module("app", [ "ngNewRouter", "ngResource", "app.home", "app.about", "directives" ]).controller("AppController", [ "$router", AppController ]), 
    AppController.$routeConfig = [ {
        path: "/",
        component: "home"
    }, {
        path: "/about",
        component: "about"
    } ];
}();
(function () {
    'use strict';

    angular.module('app', ['ngNewRouter', 'ngResource', 'app.home', 'app.about', 'directives'])
      .controller('AppController', ['$router', AppController]);

    AppController.$routeConfig = [
        { path: '/', component: 'home' },
        { path: '/about', component: 'about' }
    ];
    function AppController($router) { }
})();
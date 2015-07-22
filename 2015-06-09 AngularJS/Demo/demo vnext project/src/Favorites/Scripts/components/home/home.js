(function () {
    'use strict';

    angular.module('app.home', [])
      .controller('HomeController', [function () {
          this.favorites = ['C#', 'JavaScript', 'Angular'];
      }]);
        
})();
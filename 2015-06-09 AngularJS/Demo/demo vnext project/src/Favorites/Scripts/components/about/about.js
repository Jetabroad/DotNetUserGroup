(function () {
    'use strict';

    angular.module('app.about', ['directives'])
      .controller('AboutController', [function () {
          this.name = 'About';
      }]);
        
})();
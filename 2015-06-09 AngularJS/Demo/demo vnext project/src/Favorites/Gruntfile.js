/*
This file in the main entry point for defining grunt tasks and using grunt plugins.
Click here to learn more. http://go.microsoft.com/fwlink/?LinkID=513275&clcid=0x409
*/
module.exports = function (grunt) {
    // load Grunt plugins from NPM
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');

    // configure plugins
    grunt.initConfig({
        uglify: {
            app: {
                options: { beautify: true, mangle: false },
                files: {
                    'wwwroot/lib.js': [
                        'bower_components/jQuery/dist/*.min.js',
                        'bower_components/angular/angular.js',
                        'bower_components/angular-new-router/dist/router.es5.js',
                        'bower_components/angular-resource/angular-resource.js'
                    ],
                    'wwwroot/app.js': ['Scripts/components/**/*.js', 'Scripts/directives/**/*.js', 'Scripts/app.js']
                }
            }
        },
        
        copy: {
            templates: {
                files: [
                    {
                        cwd: 'Scripts',
                        src: '**/*.html',
                        dest: 'wwwroot',
                        expand: true
                    }
                ]
            }
        },
        
        watch: {
            scripts: {
                files: ['Scripts/**/*'],
                tasks: ['uglify', 'copy']
            }
        }
    });

    // define tasks
    grunt.registerTask('default', ['uglify', 'copy', 'watch']);
};
// TODO: npm shrinkwrap

module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);
//    require('minifyify');

    grunt.initConfig({
        // Build
            // ORDER?
        clean: {
            www: {
                src: ['www']
            },
            temp: {
                src: ['temp']
            }
        },
        copy: {
            files: {
                files: [
                    {
                        expand: true,
                        cwd: 'src/',
                        src: [
                            'partials/*.html',
                            '*.html',
                            'tests/**',
                            '*.json',
                            'Gruntfile.js'
                        ],
                        dest: 'www',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        src: [
                            'tests/**',
                            '*.json',
                            'Gruntfile.js'
                        ],
                        dest: 'www',
                        filter: 'isFile'
                    }
                ]
            },

            less: {
                expand: true,
                cwd: 'src/less/',
                src: ['*.less'],
                dest: 'temp/less',
                filter: 'isFile'
            }
        },
        less: {
            files: {
                'temp/css/app.css': 'temp/less/app.less',
            }
        },
        cssmin: {
            files: {
                'www/css/app.css': ['temp/css/app.css']
            }
        },
        browserify: {
            js: {
                files: [
                    {
                        src: 'src/app.js',
                        dest: 'www/app.js'
                    }
                ]
            }
        },
        uglify: {
            options: {
                mangle: false
            },
            my_target: {
                files: {
                    'www/app.js': 'www/app.js'
                }
            }
        },
        // TODO: jshint, uglify



        // Test

        // Inspect

        // Package
            // TODO: version bump

        // Connect
        connect: {
            server: {
                options: {
                    port: 3000,
                    base: 'www',
                    keepalive: true
                }
            }
        }
    });

    grunt.registerTask('build',
        [
            'clean:www',
            'copy:files',
            'copy:less',
            'less',
            'cssmin',
            'browserify',
//            'uglify',
            'clean:temp'
        ]
    );
    grunt.registerTask('localhost', ['build', 'connect']);  // host locally

    grunt.registerTask('test', []);
    grunt.registerTask('inspect', []);
    grunt.registerTask('package', []);
    grunt.registerTask('jenkins', ['build', 'test', 'inspect', 'package']);


};

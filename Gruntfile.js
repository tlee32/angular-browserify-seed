// TODO: npm shrinkwrap

module.exports = function(grunt) {

    // Load all
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // Build
        clean: {
            www: {
                src: ['www']
            },
            temp: {
                src: ['temp']
            },
            browserify: {
                src: ['b']
            }
        },
        copy: {
            files: {
                files: [
                    {
                        expand: true,
                        cwd: 'src/',
                        src: [
                            '**/*.html',
                            '*.html'
                        ],
                        dest: 'www',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        src: [
                            '*.json',
                            'Gruntfile.js',
                            'scripts/jenkins.sh',
                            'npm-shrinkwrap.json'
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
            default: {
                files: {
                    'temp/css/app.css': 'temp/less/app.less'
                }
            }
        },
        cssmin: {
            default: {
                files: {
                    'www/css/app.css': ['temp/css/app.css']
                }
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
            },
            test: {
                files: [
                    {
                        src: 'tests/entry.js',
                        dest: 'browserified.js'
                    }
                ]
            }
        },
        jshint: {
            ignore_warning: {
                options: {
                    '-W097': true,  // ignore: 'use strict' has to be wrapped in fn
                                        // browserify will wrap it
                    globals: {
                        angular: false,
                        require: false,
                        module: false,
                        _: false,
                        $: false,
                        document: false,
                        navigator: false,
                        console: false
                    },
                    ignores: ['src/less/*.less', 'src/**/*.html']
                },
                src: ['src/**']
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
        shell: {
            production_node_modules: {
                command: 'cd www; npm install --production; cd ..',
                options: {
                    async: true,
                    stdout: true,
                    stderr: true
                }
            },
            shrinkwrap: {
                command: 'npm shrinkwrap --dev'
            }

        },
        jasmine: {
            src: [
                'browserified.js'
            ],
            options: {
                junit: {
                    path: 'tests/output/junit'
                },
                template: require('grunt-template-jasmine-istanbul'),
                templateOptions: {
                    coverage: 'tests/output/coverage/coverage.json',
                    report: [
                        {type: 'cobertura', options: {dir: 'tests/output/coverage/cobertura'}},
                        {type: 'lcov', options: {dir: 'tests/output/coverage/lcov'}}
                    ],
                    thresholds: {
                        'lines': 0,
                        'statements': 0,
                        'branches': 0,
                        'functions': 0
                    }
                }
            }
        },

        // Test

        // Inspect

        // Package
        easy_rpm: {
            release: {
                options: {
                    name: '<%=pkg.name%>',
                    version: '<%=pkg.version%>',
                    license: '<%=pkg.license%>'

                    /*
                    preInstallScript: [
                        "sudo mkdir -p /var/www"
                    ],
                    postInstallScript: [
                        "cd var/www/customer-app-prod",
                        // the customer-app init.d script must be placed into /etc/init.d/
                        // see below for the script
                        "sudo mv scripts/customer-app /etc/init.d/",
                        // make sure that everyone can run the service
                        "sudo chmod a+x /etc/init.d/customer-app",
                        // make sure that files are laid down in the correct places
                        "python scripts/rpm_tests.py"
                    ],
                    preUninstallScript: [
                        "sudo service customer-app stop",
                        // make sure to remove the service script from /etc/init.d with a pre-uninstall script
                        "sudo rm /etc/init.d/customer-app"
                    ]
                    */

                },
                files: [
                    {src: "www/**", dest: "/var/www/"}
                ]
            }
        },
            // TODO: version bump
        bump: {
            options: {
                files: ['package.json']
            }
        },

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
            'jshint',
            'shell:shrinkwrap',
            'copy:files',
            'copy:less',
            'less',
            'cssmin',
            'browserify:js',
            'uglify',
            'clean:temp'
        ]
    );
    grunt.registerTask('localhost', ['build', 'connect']);  // host locally

    grunt.registerTask('test', ['clean:browserify', 'browserify:test', 'jasmine']);
    grunt.registerTask('inspect', []);
    grunt.registerTask('package', ['bump', 'easy_rpm']);
    grunt.registerTask('jenkins', ['build', 'shell:production_node_modules', 'test', 'inspect', 'package']);

};

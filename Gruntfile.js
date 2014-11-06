module.exports = function(grunt) {

    // Load all grunt tasks
    require('load-grunt-tasks')(grunt);

    /** CONFIGURATION **/
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        newVersion: '',
        snapshot: '',

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
                            'assets/**',
                            '*.html'
                        ],
                        dest: 'www',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        src: [
                            'package.json'
                        ],
                        dest: 'www',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        cwd: 'node_modules/bootstrap/dist/css/',
                        src: ['bootstrap.css'],
                        dest: 'www/css',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        cwd: 'lib/angular-carousel/',
                        src: ['angular-carousel.css'],
                        dest: 'www/css',
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
        concat: {
            less: {
                src: 'src/**/*.less',
                dest: 'temp/less/app.less'
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
                options: {
                    external: [
                        'angular',
                        'lodash',
                        'angular-route'
                    ]
                },
                files: [
                    {
                        src: 'src/app.js',
                        dest: 'www/app.js'
                    }
                ]
            },
            vendor: {
                src: ['src/dependencies.js'],
                dest: 'www/vendor.js'
            },
            'vendor-test': {
                src: ['src/dependencies.js', 'tests/dependencies.js'],
                dest: 'www/vendor.js'
            },
            test: {
                files: [
                    {
                        options: {
                            external: [
                                'angular-mocks'
                            ]
                        },
                        src: 'tests/entry.js',
                        dest: 'tests.js'
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
                        history: false,
                        document: false,
                        navigator: false,
                        console: false,
                        jQuery: false,
                        window: false,
                        setTimeout: false,
                        _: false,
                        moment: false
                    },
                    ignores: ['src/**/*.less', 'src/**/*.html', 'src/**/*.png', 'src/**/*.jpg', 'src/**/*.css', 'src/**/icomoon*']
                },
                src: ['src/**']
            }
        },
        uglify: {
            options: {
                mangle: false,
                compress: {
                    drop_console: true
                },
                preserveComments: false
            },
            my_target: {
                files: {
                    'www/app.js': 'www/app.js',
                    'www/vendor.js': 'www/vendor.js'
                }
            }
        },
        wrap: {
            versionToHtml: {
                src: ['www/index.html'],
                expand: true,
                options: {
                    wrapper: ['<!-- Version: ' + '<%=newVersion%>' + '<%=snapshot%>' + ' -->', '']
                }
            }
        },
        shell: {
            shrinkwrap: {
                command: 'npm shrinkwrap --dev'
            },
            push: {
                command: [
                    'git status',
                    'git add package.json',
                    'git commit -m ":loudspeaker: Bumped to ' + '<%= newVersion %>' + '-SNAPSHOT :star:"',
                    'git push -u origin master'
                ].join('&&')
            },
            'push-tag': {
                command: [
                    'git status',
                    'git add package.json',
                    'git commit -m ":loudspeaker: Released to ' + '<%= pkg.version %>' + ' :star:"',
                    'git tag -a ' + '<%= pkg.version %>' + ' -m ":loudspeaker: Tag to ' + '<%= pkg.version %>' + ':star:"',
                    'git push --tags'
                ].join('&&')
            },
            'checkout-latest': {
                command: 'git checkout -B master origin/master'
            }
        },

        cacheBust: {
            default: {
                options: {
                    encoding: 'utf8',
                    algorithm: 'md5',
                    length: 16
                },
                files: [{
                    expand: true,
                    cwd: 'www',
                    src: ['*.html', '*.css'],
                    dest: 'www/'
                }]
            }
        },

        ngtemplates: {
            Templates: {
                cwd: 'src/',
                src: '**/*.tpl.html',
                dest: 'www/templates.js',
                options: {
                    htmlmin: {collapseWhitespace: true, collapseBooleanAttributes: true}
                }
            }
        },
        "file-creator": {
            jenkinsEnvProperties: {
                "EnvFile.properties": function(fs, fd, done) {
//                    fs.writeSync(fd, "version = " + "<%= pkg.version %>");    // this doesn't work...
                    fs.writeSync(fd, "version = " + grunt.file.readJSON("package.json").version);
                    done();
                }
            }
        },

        // Test
        jasmine: {
            src: [
                'www/app.js'
            ],
            options: {
                vendor: ['www/vendor.js'],
                specs: 'tests.js',
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

        // Inspect
        // TODO

        // Package
        easy_rpm: {
            options: {
                name: '<%= pkg.name %>',
                version: '<%=newVersion%>',
                license: 'None',
                postInstallScript: [
                    'chown -R nginx:nginx /var/www/' + '<%= pkg.name %>'
                ],
                postUninstallScript: [
                    'rm -r /var/www/' + '<%= pkg.name %>'
                ]
            },
            release: {
                files: [
                    {
                        cwd: 'www',
                        src: "**",
                        dest: "/var/www/" + "<%= pkg.name %>",
                        owner: 'nginx',
                        group: 'nginx'
                    }
                ]
            }
        },
        compress: {
            main: {
                options: {
                    archive: grunt.file.readJSON("package.json").name + '-' + grunt.file.readJSON('package.json').version + '.zip'
                },
                files: [
                    {
                        expand: true,
                        cwd: 'www',
                        src: ['**'],
                        dest: '<%= pkg.name %>' + '/'
                    }
                ]
            }
        },

        // Version
        'json-replace': {
            add: {
                options: {
                    space: '\t',
                    replace: {
                        version: '<%= pkg.version %>' + '-SNAPSHOT'
                    }
                },
                files: [{src: 'package.json', dest: 'package.json'}]
            },
            remove: {
                options: {
                    space: '\t',
                    replace: {
                        version: grunt.file.readJSON('package.json').version.split('-')[0]
                    }
                },
                files: [{src: 'package.json', dest: 'package.json'}]
            },
            version: {
                options: {
                    space: '\t',
                    replace: {
                        version: '<%= newVersion %>' + '-SNAPSHOT'
                    }
                },
                files: [{src: 'package.json', dest: 'package.json'}]
            }
        },

        // Connect
        connect: {
            server: {
                options: {
                    port: 3000,
                    base: 'www',
                    livereload: true
                }
            }
        },
        watch: {
            all: {
                files: ['src/**/*.html', 'src/**/*.js', 'src/**/*.less'],
                tasks: 'build'
            }
        }
    });

    /** TASKS **/
    grunt.registerTask('build',
        [
            'clean:www',
            'jshint',
            'concat',
            'copy:files',
            'less',
            'cssmin',
            'browserify:vendor',
            'browserify:js',
            'wrap:versionToHtml',
            'ngtemplates',
            'cacheBust',
            'clean:temp'
        ]
    );

    grunt.registerTask('prod-build',
        [
            'clean:www',
            'jshint',
//            'shell:shrinkwrap',
            'concat',
            'copy:files',
            'less',
            'cssmin',
            'browserify:vendor',
            'browserify:js',
            'uglify',
            'wrap:versionToHtml',
            'ngtemplates',
            'cacheBust',
            'clean:temp',
            'file-creator:jenkinsEnvProperties'
        ]
    );

    // Run Locally
    grunt.registerTask('localhost', ['build', 'connect', 'watch']);

    // Version
    grunt.registerTask('set-snapshot', function() {
        grunt.config('snapshot', '-SNAPSHOT');
    });

    grunt.registerTask('set-new-version', function() {
        grunt.config('newVersion', grunt.file.readJSON('package.json').version.split('-')[0]);
        console.log(grunt.config('newVersion'));
    });
    grunt.registerTask('compute-new-version', function() {
        var oldVersion = grunt.file.readJSON('package.json').version;
        oldVersion = oldVersion.split('-')[0];
        grunt.config('newVersion', '0.0.' + (parseInt(oldVersion.split('.')[2]) + 1));
        console.log(grunt.config('newVersion'));
    });

    grunt.registerTask('add-snapshot', ['json-replace:add']);
    grunt.registerTask('remove-snapshot', ['json-replace:remove', 'set-new-version']);
    grunt.registerTask('write-new-version', ['json-replace:version']);

    grunt.registerTask('update-version', ['compute-new-version', 'write-new-version']);

    // Test
    grunt.registerTask('test', ['clean:browserify', 'browserify:vendor-test', 'browserify:js', 'browserify:test', 'jasmine']);
    grunt.registerTask('testem', ['clean:browserify', 'browserify:vendor-test', 'browserify:js', 'browserify:test']);

    // Inspect
    grunt.registerTask('inspect', []);

    // Package
    grunt.registerTask('package-rpm', ['easy_rpm']);
    grunt.registerTask('package', ['compress']);

    // Push
    grunt.registerTask('push', ['shell:push']);

    // Push Tag
    grunt.registerTask('push-tag', ['shell:push-tag']);

    // Checkout Latest
    grunt.registerTask('checkout-latest', ['shell:checkout-latest']);

    // Jenkins Builds
    grunt.registerTask('continuous', ['prod-build', 'test', 'inspect']);
    grunt.registerTask('snapshot',
        [
            'set-snapshot',
            'update-version',
            'prod-build',
            'test',
            'inspect',
            'package-rpm'
        ]
    );

    grunt.registerTask('snapshot-push', ['set-new-version', 'push']);

    grunt.registerTask('release',
        [
            'remove-snapshot',
            'prod-build',
            'test',
            'inspect',
            'package-rpm'
        ]
    );

    grunt.registerTask('release-tag-push',
        [
            'push-tag',
            'checkout-latest',
            'update-version',
            'push'
        ]
    );

    /** NOTES **/
    // doesn't work in jenkins b/c centOS can't run grunt-testem...
    // grunt.registerTask('test', ['clean:browserify', 'browserify:test', 'testem']);

};

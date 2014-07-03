var rest = require('rest'),
    pathPrefix = require('rest/interceptor/pathPrefix'),
    basicAuth = require('rest/interceptor/basicAuth'),
    errorCode = require('rest/interceptor/errorCode'),
    defaultRequest = require('rest/interceptor/defaultRequest'),
    location = require('rest/interceptor/location'),
    mime = require('rest/interceptor/mime'),
    OAuth = require('rest/interceptor/oAuth'),
    when = require('when'),
    _ = require("lodash");

var ServiceProvider = function(path, userAgent) {
    // possible options:
    // path - default: '/' = scheme+host+port [DONE]
    // User-Agent => set as [DONE]
        // required: application = OAuth Provider, developer = (username/email)
    // interceptors...

    // TODO: make this private
    this.Client = function(clientOptions) {
        // possible options:
        // headers [DONE]
            // language - Accept-Language
            // mime types => accept-* headers (Accept & Accept-Language)
        // authentication - username, pw [DONE]
        // TODO: oAuth
        // TODO: linking?
        // TODO: add json boolean parameter? => add Content-Type: "application/json"
        // TODO: timeout?

        clientOptions = clientOptions || {};

        clientOptions.headers = clientOptions.headers || {};
        if (userAgent) clientOptions.headers['User-Agent'] = userAgent;

        // INTERCEPTORS
        var client = rest
            .chain(defaultRequest, {headers: clientOptions.headers, path: '', entity: ''})
            // this causes 410 (gone) to be an error
//            .chain(errorCode)
            // these cause errors for POST... not sure why... might be redirecting...
            // might be redirecting you to the object that was just created...
//            .chain(location)
            .chain(mime, {mime: "application/json"});

        // depending on client options:
        if (path) client = pathPrefix(client, {prefix: path});
        if (clientOptions.basicAuth) client = basicAuth(client, {username: clientOptions.basicAuth.username, password: clientOptions.basicAuth.password});
        if (clientOptions.OAuth) client = OAuth(client);

        // HELPER FUNCTIONS
        function setUpRestObj(method, path, entity, options) {
            if (typeof path === 'string' || path instanceof String) {
                if (path.length !== 1 && path.substr(0, 1) === '/') path = path.substr(1, path.length-1);
                options = options || {};

                var restObj = JSON.parse(JSON.stringify(clientOptions));
                restObj.path = path;
                if (method !== 'POST') {
                    restObj.method = method;
                }


                if (entity) restObj.entity = entity;

                // TODO: what if we don't want to include keys from the clientOptions? set as undefined?
                if (typeof options === 'object' || options instanceof Object) {
                    if (options.params) restObj.params = options.params;

                    if (options.headers && (typeof options.headers === 'object' || options.headers instanceof Object)) {
                        restObj.headers = options.headers;
                        var property;
                        for (property in options.headers) {
                            if (options.headers.hasOwnProperty(property)) {
                                restObj[property] = options.headers[property];
                            }
                        }
                    }
                }
                return restObj;
            } else {
                return {error: "Path was not provided."};
            }
        }

        return {
            get: function(path, options) {
                var obj = setUpRestObj('GET', path, null, options);
                if (obj.error) {
                    return when.reject(obj.error);
                } else {
                    return client(obj);
                }
            },
            post: function(path, entity, options) {
                var obj = setUpRestObj('POST', path, entity, options);

                if (obj.error) {
                    return when.reject(obj.error);
                } else {
                    return client(obj);
                }
            },
            put: function(path, entity, options) {
                var obj = setUpRestObj('PUT', path, entity, options);
                if (obj.error) {
                    return when.reject(obj.error);
                } else {
                    return client(obj);
                }
            },
            delete: function(path, options) {
                var obj = setUpRestObj('DELETE', path, {}, options);
                if (obj.error) {
                    return when.reject(obj.error);
                } else {
                    return client(obj);
                }
            }
        }
    };

    this.createClient = function(options) {
        return new this.Client(options);
    };
};

module.exports = ServiceProvider;


// representations:
// - application/json
// - rbc.collection media type
// - rbc.object media type
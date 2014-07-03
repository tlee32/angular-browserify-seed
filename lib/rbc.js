/***************************** rbcBridgeKernel *****************************/


var RBCBridgePlatforms =
{
    UNKNOWN : 0,
    IOS     : 1,
    ANDROID : 2,
    WP      : 3
};

var RBCBridgeStates =
{
    NOT_INITIALIZED     : 0,
    WAIT_PARAMETERS     : 1,
    INITIALIZED         : 2,
    IN_FLIGHT           : 3
};

var RBCPromise = function ()
{
    this.onSuccessCallbacks = [];
    this.onFailedCallbacks = [];
};

RBCPromise.prototype.then = function (onSuccess, onFailed)
{
    if (onSuccess != null && onSuccess !== undefined)
        this.onSuccessCallbacks.push(onSuccess);

    if (onFailed != null && onFailed !== undefined)
        this.onFailedCallbacks.push(onFailed);

    return this;
};

RBCPromise.prototype.fail = function (onFailed)
{
    if (onFailed != null && onFailed !== undefined)
        this.onFailedCallbacks.push(onFailed);

    return this;
};

RBCPromise.prototype.success = function (onSuccess)
{
    if (onSuccess != null && onSuccess !== undefined)
        this.onSuccessCallbacks.push(onSuccess);

    return this;
};

RBCPromise.prototype.finishedSuccessfully = function (info)
{
    var callbacksCount = this.onSuccessCallbacks.length;
    for (var i = 0; i < callbacksCount; i++)
    {
        this.onSuccessCallbacks[i](info);
    }
};

RBCPromise.prototype.finishedWithError = function (error)
{
    var callbacksCount = this.onFailedCallbacks.length;
    for (var i = 0; i < callbacksCount; i++)
    {
        this.onFailedCallbacks[i](error);
    }
};

function rbcWindowsPhoneNotifyHack( str )
{
    window.external.notify( str );
}

window.RBCBridge =
{
    bridgeVersion: "0.0.1",
    bridgeScheme: "rbc://",

    state: RBCBridgeStates.NOT_INITIALIZED,
    platform: RBCBridgePlatforms.UNKNOWN,

    nativeCalls: new Object(),
    lastNativeCallId: 0,

    iosURLQueue: [],

    initializeCallbacks: null,

    preloadParameters: null,
    preloadCallbacks: null,

    initialized: function(initializeCallback)
    {
        if (this.isInitialized())
        {
            // This bridge already initialized

            initializeCallback();

            return;
        }

        if (this.initializeCallbacks == null)
        {
            this.initializeCallbacks = [ initializeCallback ];
            return;
        }

        this.initializeCallbacks.push(initializeCallback);
    },

    isInitialized: function()
    {
        return (this.state == RBCBridgeStates.INITIALIZED ||
            this.state == RBCBridgeStates.IN_FLIGHT);
    },

    initializationComplete: function( platform )
    {
        if (this.platform != RBCBridgePlatforms.UNKNOWN)
            return;

        if (platform === 'ios')
            this.platform = RBCBridgePlatforms.IOS;
        else if (platform === 'android')
            this.platform = RBCBridgePlatforms.ANDROID;
        else if (platform === 'wp')
            this.platform = RBCBridgePlatforms.WP;
        else
            return;

        if (this.preloadParameters != null)
        {
            // Load parameters
            this.state = RBCBridgeStates.INITIALIZED;

            this.exec("internal", "getParameters", this.preloadParameters, function(parameters)
            {
                for (var module in parameters)
                {
                    var values = parameters[module];
                    var callback = RBCBridge.preloadCallbacks[module];
                    var result = new Object();
                    result[module] = values;

                    callback(result);
                }

                RBCBridge.preloadParameters = null;
                RBCBridge.preloadCallbacks = null;

                setTimeout(function() {
                    RBCBridge._initilizationFinished();
                }, 0);
            });

            this.state = RBCBridgeStates.WAIT_PARAMETERS;
            return this.bridgeVersion;
        }

        this._initilizationFinished();

        return this.bridgeVersion;
    },

    _initilizationFinished: function()
    {
        this.state = RBCBridgeStates.INITIALIZED;

        for (var key in this.nativeCalls)
        {
            var callInfo = this.nativeCalls[key];

            this.execAfterInitialization(callInfo);
        }

        if (this.initializeCallbacks != null)
        {
            var callbacksCount = this.initializeCallbacks.length;
            for (var i = 0; i < callbacksCount; i++)
                this.initializeCallbacks[i]();

            this.initializeCallbacks = null;
        }
    },

    loadParameters: function( module, parametersList, callback)
    {
        if (this.isInitialized())
        {
            // Load parameters now
            var parameters = new Object();
            parameters[module] = parametersList;
            this.exec("internal", "getParameters", parameters, callback, null);

            return;
        }

        if (this.preloadParameters == null)
        {
            this.preloadParameters = new Object();
            this.preloadCallbacks = new Object();
        }

        this.preloadParameters[module] = parametersList;
        this.preloadCallbacks[module] = callback;
    },

    getCallId: function ()
    {
        this.lastNativeCallId ++;
        return ""+this.lastNativeCallId;
    },

    stringify: function ( parameters )
    {
        if (parameters == null || parameters === undefined)
            return "null";
        return JSON.stringify(parameters);
    },

    buildCallUrl: function ( moduleName, functionName, callId, parameters, dontUseScheme )
    {
        var url = "";

        if (dontUseScheme == null || dontUseScheme == undefined || dontUseScheme == false)
            url = this.bridgeScheme;

        url += moduleName + "/" + functionName;

        if (callId == null || callId === undefined)
            return url;

        url += "/" + callId;

        if (parameters == null || parameters === undefined)
            return url;

        url += "/" + this.stringify(parameters);

        return url;
    },

    sendNativeCallInURL: function ( url )
    {
        var iframe = document.createElement("IFRAME");
        iframe.setAttribute("src", encodeURI(url));
        document.documentElement.appendChild(iframe);
        iframe.parentNode.removeChild(iframe);

        iframe = null;
    },

    exec: function ( moduleName, functionName, parameters, successCallback, failedCallback, convertOut )
    {
        if (convertOut === undefined)
            convertOut = null;

        var callId = this.getCallId();

        var callInfo =
        {
            callId: callId,
            convertOut: convertOut,
            promise: new RBCPromise()
        };

        callInfo.promise.then(successCallback, failedCallback);

        this.nativeCalls[callId] = callInfo;

        if (this.state == RBCBridgeStates.NOT_INITIALIZED)
        {
            // Bridge not initialized yet
            callInfo["moduleName"] = moduleName;
            callInfo["functionName"] = functionName;
            callInfo["parameters"] = parameters;

            return callInfo.promise;
        }

        setTimeout(function() {
            RBCBridge.execAfterInitialization(callInfo, moduleName, functionName, parameters);
        }, 0);

        return callInfo.promise;
    },

    prepareArguments: function (argumentsList, args, convertIn)
    {
        var parameters = new Object();
        var successCallback = null;
        var failedCallback = null;

        var paramArguments = [];
        var argsArray = Array.prototype.slice.call(args, 0);

        if (convertIn === undefined)
            convertIn = null;

        // Find callbacks only
        var argIndex = 0;
        for (var i = 0; i < argumentsList.length; i++)
        {
            var argName = argumentsList[i];

            if (argName == "successCallback")
            {
                for (;argIndex<argsArray.length;argIndex++)
                {
                    var argValue = argsArray[argIndex];
                    if (typeof argValue == 'function')
                    {
                        // First function in arguments
                        successCallback = argValue;
                        argsArray.splice(argIndex, 1);
                        break;
                    }
                }
            }else if (argName == "failedCallback")
            {
                for (;argIndex<argsArray.length;argIndex++)
                {
                    var argValue = argsArray[argIndex];
                    if (typeof argValue == 'function')
                    {
                        // First function in arguments
                        failedCallback = argValue;
                        argsArray.splice(argIndex, 1);
                        break;
                    }
                }
            }else
                paramArguments.push(argName);
        }

        if (paramArguments.length > 0)
        {
            for (var i = 0; i < paramArguments.length; i++)
            {
                var argName = paramArguments[i];

                if (argsArray.length < i)
                    break;

                var argValue = argsArray[i];

                if (argValue != null && argValue != undefined)
                {
                    if (argValue instanceof Date)
                    {
                        argValue = argValue.getTime()
                    }

                    parameters[argName] = (convertIn == null) ? argValue : convertIn(argName, argValue);
                }
            }
        }

        if (parameters.length == 0)
            parameters = null;

        return {"successCallback":successCallback, "failedCallback":failedCallback, "parameters":parameters};
    },

    execWithArguments: function (moduleName, functionName, argumentsList, args, convertIn, convertOut)
    {
        var preparedArguments = this.prepareArguments(argumentsList, args, convertIn);

        if (convertIn === undefined)
            convertIn = null;

        return this.exec(moduleName, functionName, preparedArguments.parameters, preparedArguments.successCallback, preparedArguments.failedCallback, convertOut);
    },

    execAfterInitialization: function(callInfo, moduleName, functionName, parameters)
    {
        var universalModuleName = moduleName;
        if (universalModuleName == null || universalModuleName === undefined)
            universalModuleName = callInfo.moduleName;

        var universalFunctionName = functionName;
        if (universalFunctionName == null || universalFunctionName === undefined)
            universalFunctionName = callInfo.functionName;

        var universalParameters = parameters;
        if (universalParameters == null || universalParameters === undefined)
            universalParameters = callInfo.parameters;

        if (this.platform == RBCBridgePlatforms.ANDROID)
        {
            RBCAndroidBridgeInterface.execute(universalModuleName, universalFunctionName, callInfo.callId, this.stringify(universalParameters));

            return;
        }

        var callUrl = this.buildCallUrl(universalModuleName, universalFunctionName, callInfo.callId, universalParameters, (this.platform == RBCBridgePlatforms.WP));

        if (this.platform == RBCBridgePlatforms.WP)
        {
            rbcWindowsPhoneNotifyHack(callUrl);
            return;
        }

        if (this.state == RBCBridgeStates.WAIT_PARAMETERS)
        {
            this.sendNativeCallInURL( callUrl );
            return;
        }

        if (this.state == RBCBridgeStates.IN_FLIGHT)
        {
            this.iosURLQueue.push( callUrl );

            return;
        }

        this.state = RBCBridgeStates.IN_FLIGHT;
        this.sendNativeCallInURL( callUrl );
    },

    iosNativeCallReceived: function()
    {
        if (this.state == RBCBridgeStates.WAIT_PARAMETERS)
            return;

        if ( this.iosURLQueue.length == 0 )
        {
            this.state = RBCBridgeStates.INITIALIZED;
            return;
        }

        var callUrl = this.iosURLQueue.shift();
        this.sendNativeCallInURL( callUrl );
    },

    nativeCallComplete: function( callId, status, response )
    {
        var callInfo = this.nativeCalls[callId];

        if (callInfo == null ||
            callInfo === undefined)
            return;

        if (status != false)
            callInfo.promise.finishedSuccessfully((callInfo.convertOut == null) ? response : callInfo.convertOut(response));
        else
            callInfo.promise.finishedWithError(response);

        if (status === true || status == false)
            delete this.nativeCalls[callId];
    },

    notifyEventListeners: function ( eventName, information )
    {
        events.notifyEventListeners (eventName, information);
    }
};

window.events =
{
    eventListeners: new Object(),
    internalEvents: [],
    unregisteredObservers: null,

    addEventListener: function( eventName, callback )
    {
        if ( eventName == null || eventName === undefined)
            return;

        if ( callback == null || callback === undefined)
            return;

        var isNewEventListener = false;
        if (this.eventListeners[ eventName ] == null)
        {
            this.eventListeners[ eventName ] = [];
            isNewEventListener = true;
        }

        this.eventListeners[ eventName ].push( callback );

        if (isNewEventListener && (this.internalEvents.indexOf(eventName) < 0))
        {
            var needSetTimer = false;
            if (this.unregisteredObservers == null)
            {
                this.unregisteredObservers = [];
                needSetTimer = true;
            }

            this.unregisteredObservers.push(eventName);

            if (needSetTimer && RBCBridge.isInitialized())
            {
                setTimeout(function() {
                    events.sendUnregisteredObservers();
                }, 0);
            }
        }
    },

    removeEventListener: function( eventName, callback )
    {
        if ( eventName == null || eventName === undefined)
            return;

        if (this.eventListeners[ eventName ] == null)
            return;

        if (callback == null || callback === undefined)
        {
            // Remove all event eventListeners
            this.eventListeners[ eventName ] = [];
        }else
        {
            // Remove specific element
            var index = this.eventListeners[ eventName ].indexOf(callback);
            if (index > -1)
                this.eventListeners[ eventName ].splice(index, 1);
        }


        if (this.eventListeners[ eventName ].length == 0)
        {
            delete this.eventListeners[ eventName ];
            if (this.internalEvents.indexOf(eventName) < 0)
            {
                if (this.unregisteredObservers != null)
                {
                    var eventIndex = this.unregisteredObservers.indexOf(eventName);
                    if (eventIndex > -1)
                        this.unregisteredObservers.splice(eventIndex, 1);
                    return;
                }

                RBCBridge.exec( "internal", "removeObservers", {"events" : [ eventName ]} );
            }
        }
    },

    notifyEventListeners: function ( eventName, information )
    {
        if ( eventName == null || eventName === undefined)
            return;

        if (this.eventListeners[ eventName ] == null)
            return;

        var callbacksCount = this.eventListeners[ eventName ].length;
        for (var i = 0; i < callbacksCount; i++)
        {
            try
            {
                this.eventListeners[ eventName ][i](information);
            }
            catch(e)
            {

            }
        }
    },

    setInternalEvents: function ( events )
    {
        for (var i = 0; i < events.length; i++)
        {
            this.internalEvents.push(events[i]);
        }
    },

    sendUnregisteredObservers: function ()
    {
        if (events.unregisteredObservers != null && events.unregisteredObservers.length > 0)
            RBCBridge.exec( "internal", "addObservers", {"events" : events.unregisteredObservers} );

        events.unregisteredObservers = null;
    }
};

RBCBridge.initialized(events.sendUnregisteredObservers);


/***************************** errors *****************************/


window.RBCErrors = {}

RBCErrors.Unknown			 	= 0;
RBCErrors.ModuleNotSupported 	= 1;
RBCErrors.FunctionNotSupported 	= 2;
RBCErrors.PermissionDenied		= 3;
RBCErrors.WrongParameters 		= 4;
RBCErrors.Timeout		 		= 5;
RBCErrors.Formatting			= 6;
RBCErrors.Parsing				= 7;
RBCErrors.CancelledByUser		= 8;
RBCErrors.NotFound				= 9;
RBCErrors.Internal				= 1000;


/***************************** device *****************************/


window.device =
{
    model: null,
    platform: null,
    uuid: null,
    version: null,
    name: null,

    ready: function ( readyCallback )
    {
        RBCBridge.initialized(readyCallback);

        return this;
    },

    pause: function ( callback )
    {
        events.addEventListener("device.pause", callback);

        return this;
    },

    resume: function ( callback )
    {
        events.addEventListener("device.resume", callback);

        return this;
    }
}

RBCBridge.loadParameters("device", ["model", "platform", "uuid", "version", "name"], function (parameters) {
    device.model    = parameters.device.model;
    device.platform = parameters.device.platform;
    device.uuid     = parameters.device.uuid;
    device.version  = parameters.device.version;
    device.name     = parameters.device.name;
});


/***************************** connection *****************************/


window.connection =
{
    TYPES : { UNKNOWN  : "unknown",
        ETHERNET : "ethernet",
        WIFI     : "wifi",
        CELL_2G  : "2g",
        CELL_3G  : "3g",
        CELL_4G  : "4g",
        CELL     : "cellular",
        NONE     : "none"},

    STATES: { UNKNOWN  : "unknown",
        ONLINE   : "online",
        OFFLINE  : "offline"},

    type: "unknown",
    state: "unknown",

    isOnline: function ()
    {
        return (this.state == "online");
    },

    typeChanged: function ( callback )
    {
        events.addEventListener("connection.type", callback);

        return this;
    },

    stateChanged: function ( callback )
    {
        events.addEventListener("connection.state", callback);

        return this;
    }
}

RBCBridge.loadParameters("connection", ["state", "type"], function (parameters) {
    connection.state = parameters.connection.state;
    connection.type = parameters.connection.type;
});

connection.typeChanged( function(info) {
    connection.type = info.type;
}).stateChanged( function(info) {
        connection.state = info.state;
    });


/***************************** battery *****************************/


window.battery =
{
    level: null,
    isPlugged: null,

    levelChanged: function ( callback )
    {
        events.addEventListener("battery.level", callback);

        return this;
    },

    pluggedChanged: function ( callback )
    {
        events.addEventListener("battery.plugged", callback);

        return this;
    },

    low: function ( callback )
    {
        events.addEventListener("battery.low", callback);

        return this;
    },

    critical: function ( callback )
    {
        events.addEventListener("battery.critical", callback);

        return this;
    },

    _batteryStateChanged: function (info)
    {
        var state = info.state;
        if (state === undefined || state == null)
            return;

        if (state.isPlugged !== undefined)
        {
            if (this.isPlugged != state.isPlugged)
            {
                this.isPlugged = state.isPlugged;
                events.notifyEventListeners("battery.plugged", {"isPlugged":this.isPlugged});
            }
        }

        if (state.level !== undefined)
        {
            if (this.level != state.level)
            {
                this.level = state.level;
                events.notifyEventListeners("battery.level", {"level":this.level});

                if (this.isPlugged !== true)
                {
                    if (state.level === 20) {
                        events.notifyEventListeners("battery.low", {});
                    } else if (state.level == 5) {
                        events.notifyEventListeners("battery.critical", {});
                    }
                }
            }
        }
    }
}

RBCBridge.loadParameters("battery", ["state"], function (parameters) {
    battery._batteryStateChanged(parameters.battery);
});

events.addEventListener("battery.state", battery._batteryStateChanged);

events.setInternalEvents(["battery.level", "battery.plugged", "battery.low", "battery.critical"]);


/***************************** globalization *****************************/


window.globalization =
{
    getPreferredLanguage: function (successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getPreferredLanguage", ["successCallback", "failedCallback"], arguments);
    },

    getLocaleName: function (successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getLocaleName", ["successCallback", "failedCallback"], arguments);
    },

    dateToString: function (date, options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "dateToString", ["date", "options", "successCallback", "failedCallback"], arguments);
    },

    stringToDate: function (dateString, options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "stringToDate", ["dateString", "options", "successCallback", "failedCallback"], arguments);
    },

    getDatePattern: function (options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getDatePattern", ["options", "successCallback", "failedCallback"], arguments);
    },

    getDateNames: function (options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getDateNames", ["options", "successCallback", "failedCallback"], arguments);
    },

    isDayLightSavingsTime: function (date, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "isDayLightSavingsTime", ["date", "successCallback", "failedCallback"], arguments);
    },

    getFirstDayOfWeek: function (successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getFirstDayOfWeek", ["successCallback", "failedCallback"], arguments);
    },

    numberToString: function (number, options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "numberToString", ["number", "options", "successCallback", "failedCallback"], arguments);
    },

    stringToNumber: function (string, options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "stringToNumber", ["numberString", "options", "successCallback", "failedCallback"], arguments);
    },

    getNumberPattern: function (options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getNumberPattern", ["options", "successCallback", "failedCallback"], arguments);
    },

    getCurrencyPattern: function (currencyCode, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("globalization", "getCurrencyPattern", ["currencyCode", "successCallback", "failedCallback"], arguments);
    }
}



/***************************** notifications *****************************/


window.notifications =
{
    /*
     * options: {vibrate:float, // vibrate duration (in ms)
     mute:float, // mute duration (in ms)
     repeatCount:int // repeat count
     }
     */
    vibrate: function ( options )
    {
        return RBCBridge.execWithArguments("notifications", "vibrate", ["options"], arguments);
    },

    beep: function ( )
    {
        return RBCBridge.exec("notifications", "beep");
    },

    alert: function ( title, message, cancelButton, otherButtons, callback )
    {
        return RBCBridge.execWithArguments("notifications", "alert", ["title", "message", "cancelButton", "otherButtons", "successCallback"], arguments);
    },

    local: {
        /*
         notification: {id: string,
         title: string,
         message: string,
         badge: int,
         fireDate: Date,
         repeat: string (secondly, minutely, hourly, daily, weekly, monthly, yearly)
         otherInfo: Object or null
         }
         */

        /*
         * Create new notification
         * return value in successCallback: null
         * return value in errorCallback:
         * error {
         code: int,
         message: string
         }
         */
        add: function (notification, successCallback, errorCallback)
        {
            return RBCBridge.execWithArguments("localnotifications", "add", ["notification", "successCallback", "failedCallback"], arguments, this._convertIn);
        },

        /*
         * Cancel exist notification by id
         * Developer can put only "id" parameter to notification object. Other parameters will be ignored
         * return value in successCallback: null
         * return value in errorCallback:
         * error {
         code: int,
         message: string
         }
         */
        cancel: function (notification, successCallback, errorCallback)
        {
            return RBCBridge.execWithArguments("localnotifications", "cancel", ["notification", "successCallback", "failedCallback"], arguments, this._convertIn);
        },

        /*
         * Cancel all exist notifications
         * return value in successCallback: null
         * return value in errorCallback:
         * error {
         code: int,
         message: string
         }
         */
        cancelAll: function (successCallback, errorCallback)
        {
            return RBCBridge.execWithArguments("localnotifications", "cancelAll", ["successCallback", "failedCallback"], arguments);
        },

        /*
         * Get all scheduled notifications
         * return value in successCallback:
         * info: {
         notifications: object[] // notification objects
         }
         * return value in errorCallback:
         * error {
         code: int,
         message: string
         }
         */
        getScheduled: function (successCallback, errorCallback)
        {
            return RBCBridge.execWithArguments("localnotifications", "getScheduled", ["successCallback", "failedCallback"], arguments, null, this._convertOut);
        },

        /*
         * Check exist notification by id
         * Developer can put only "id" parameter to notification object. Other parameters will be ignored
         * return value in successCallback:
         * info: {
         notification: object,
         isScheduled: true/false
         }
         * return value in errorCallback:
         * error {
         code: int,
         message: string
         }
         */
        isScheduled: function (notification, successCallback, errorCallback)
        {
            return RBCBridge.execWithArguments("localnotifications", "isScheduled", ["notification", "successCallback", "failedCallback"], arguments, this._convertIn);
        },

        received: function (callback)
        {
            events.addEventListener("localnotifications.received", callback);

            return this;
        },

        /************* Internal Methods *************/
        _convertIn: function (parameterName, value)
        {
            if (parameterName == "notification")
            {
                var fireDate = value.fireDate;
                if (fireDate != null && fireDate instanceof Date)
                    value.fireDate = fireDate.getTime();
            }

            return value;
        },

        _convertOut: function (value)
        {
            if (value == null)
                return null;

            if (value instanceof Object)
            {
                if (value.notifications != null)
                {
                    for (var i = 0; i < value.notifications.length; i++)
                    {
                        var notification = value.notifications[i];

                        if (notification.fireDate != null && notification.fireDate !== undefined)
                        {
                            notification.fireDate = new Date(parseFloat(notification.fireDate));
                        }
                    }
                }
            }

            return value;
        }
    }
}


/***************************** contacts *****************************/


window.contacts =
{
    /*
     contactField: {type:"", value:""},

     contactAddress:{type: "",
     formatted: "",
     streetAddress: "",
     locality: "",
     region: "",
     postalCode: "",
     country: ""},

     contactItem: {id:"",
     raw_id:"",
     displayName:"",
     name: {formatted: "", familyName: "", givenName: "", middleName: "", honorificPrefix: "", honorificSuffix: ""},
     nickname:"",
     phoneNumbers: contactField[],
     emails: contactField[],
     addresses: contactAddress[],
     birthday: Date}
     */

    /*
     * options can be null
     * default options fields: {filter: null, limit: null, offset: null, getTotalCount: true}
     */
    find: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("contacts", "find", ["options", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
    },

    findById: function ( contactId, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("contacts", "find", ["contactId", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
    },

    create: function ( contact, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("contacts", "create", ["contact", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
    },

    update: function ( contact, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("contacts", "update", ["contact", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
    },

    delete: function ( contact, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("contacts", "delete", ["contact", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
    },

    /************* Internal Methods *************/
    _convertIn: function (parameterName, value)
    {
        if (parameterName == "contact")
        {
            var birthday = value.birthday;
            if (birthday != null && birthday instanceof Date)
                value.birthday = birthday.getTime();
        }

        return value;
    },

    _convertOut: function (value)
    {
        if (value == null)
            return null;

        if (value instanceof Object)
        {
            if (value.contacts != null)
            {
                for (var i = 0; i < value.contacts.length; i++)
                {
                    var contact = value.contacts[i];

                    if (contact.birthday != null && contact.birthday !== undefined)
                    {
                        contact.birthday = new Date(parseFloat(contact.birthday));
                    }
                }
            }
        }

        return value;
    }
}


/***************************** camera *****************************/


window.barcode =
{
    TYPES: { QRCODE  : "qrcode",
        BARCODE : "barcode"},

    scan: function (options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("barcode", "scan", ["options", "successCallback", "failedCallback"], arguments);
    }
};

window.camera =
{
    DestinationType: {
        DATA_URL: 0,         // Return base64 encoded string
        APP_STORAGE: 1       // Return appStorage key
    },
    EncodingType:{
        JPEG: 0,             // Return JPEG encoded image
        PNG: 1               // Return PNG encoded image
    },
    MediaType:{
        PICTURE: 0,          // allow selection of still pictures only. DEFAULT. Will return format specified via DestinationType
        VIDEO: 1,            // allow selection of video only, ONLY RETURNS URL
        ALLMEDIA : 2         // allow selection from all media types
    },
    PictureSourceType:{
        PHOTOLIBRARY : 0,    // Choose image from picture library (same as PHOTOLIBRARY for Android)
        CAMERA : 1,          // Take picture from camera
        SAVEDPHOTOALBUM : 2  // Choose image from picture library (same as SAVEDPHOTOALBUM for Android)
    },
    Direction:{
        BACK: 0,
        FRONT: 1
    },

    /*
     * options can be null
     * default options fields: {quality: 50,
     *							destinationType: camera.DestinationType.APP_STORAGE,
     *							sourceType: camera.PictureSourceType.CAMERA,
     *							encodingType: camera.EncodingType.JPEG,
     *							mediaType: camera.MediaType.PICTURE,
     *							allowEdit: true,
     *							saveToPhotoAlbum: true,
     *							cameraDirection: camera.Direction.BACK}
     */
    getMedia: function(options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("camera", "getMedia", ["options", "successCallback", "failedCallback"], arguments);
    },

    takeMedia: function(options, successCallback, errorCallback)
    {
        var opt = options || {};
        opt.sourceType = camera.PictureSourceType.CAMERA;
        return this.getMedia(opt, successCallback, errorCallback);
    },

    chooseMedia: function(options, successCallback, errorCallback)
    {
        var opt = options || {};
        opt.sourceType = camera.PictureSourceType.PHOTOLIBRARY;
        return this.getMedia(opt, successCallback, errorCallback);
    },

    /* Record video */
    recordVideo: function(options, successCallback, errorCallback)
    {
        var opt = options || {};
        opt.mediaType = camera.MediaType.VIDEO;
        return this.takeMedia(opt, successCallback, errorCallback);
    },

    /* Choose video */
    chooseVideo: function(options, successCallback, errorCallback)
    {
        var opt = options || {};
        opt.mediaType = camera.MediaType.VIDEO;
        return this.chooseMedia(opt, successCallback, errorCallback);
    },

    /* Capture photo */
    capturePhoto: function(options, successCallback, errorCallback)
    {
        var opt = options || {};
        opt.mediaType = camera.MediaType.PICTURE;
        return this.takeMedia(opt, successCallback, errorCallback);
    },

    /* Choose photo */
    choosePhoto: function(options, successCallback, errorCallback)
    {
        var opt = options || {};
        opt.mediaType = camera.MediaType.PICTURE;
        return this.chooseMedia(opt, successCallback, errorCallback);
    },

    cleanup: function(successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("camera", "cleanup", ["successCallback", "failedCallback"], arguments);
    },

    barcode: window.barcode
};


/***************************** geolocation *****************************/


window.geolocation =
{
    /*
     * coordinatesItem: {latitude:double,
     longitude:double,
     accuracy:double,
     altitude:double,
     altitudeAccuracy:double,
     magneticHeading:dobule,
     trueHeading:double,
     speed:double}

     positionItem: {coordinates: coordinatesItem,
     timestamp: Date}
     */

    lastPosition: null,

    getCurrentPosition: function(options, successCallback, errorCallback) {
        var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);

        options = this._prepareOptions(preparedArguments.parameters.options);
        successCallback = preparedArguments.successCallback;
        errorCallback = preparedArguments.failedCallback;

        // Timer var that will fire an error callback if no position is retrieved from native
        // before the "timeout" param provided expires
        var timeoutTimer = {timer:null};

        var winCallback = function(position)
        {
            clearTimeout(timeoutTimer.timer);
            if (!(timeoutTimer.timer))
                return;

            geolocation.lastPosition = position;
            if (successCallback)
                successCallback(position);
        };
        var failCallback = function(error)
        {
            clearTimeout(timeoutTimer.timer);
            timeoutTimer.timer = null;
            if (errorCallback)
                errorCallback(error);
        };

        // Check our cached position, if its timestamp difference with current time is less than the maximumAge, then just
        // fire the success callback with the cached position.
        if (geolocation.lastPosition && options.maximumAge && (((new Date()).getTime() - geolocation.lastPosition.timestamp.getTime()) <= options.maximumAge)) {
            successCallback(geolocation.lastPosition);
        } else if (options.timeout === 0) {
            fail({
                code:RBCErrors.Timeout,
                message:"timeout value in options set to 0 and no cached Position object available, or cached Position object's age exceeds provided options maximumAge parameter."
            });
        } else {
            if (options.timeout !== Infinity) {
                // If the timeout value was not set to Infinity (default), then
                // set up a timeout function that will fire the error callback
                // if no successful position was retrieved before timeout expired.
                timeoutTimer.timer = this._createTimeout(failCallback, options.timeout);
            } else {
                // This is here so the check in the win function doesn't mess stuff up
                // may seem weird but this guarantees timeoutTimer is
                // always truthy before we call into native
                timeoutTimer.timer = true;
            }
            RBCBridge.exec("geolocation", "getLocation", {"options":options}, winCallback, failCallback, geolocation._convertOut);
        }
        return timeoutTimer;
    },

    watchPosition:function(options, successCallback, errorCallback) {
        var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);

        options = this._prepareOptions(preparedArguments.parameters.options);
        successCallback = preparedArguments.successCallback;
        errorCallback = preparedArguments.failedCallback;

        var id = this._getId();

        // Tell device to get a position ASAP, and also retrieve a reference to the timeout timer generated in getCurrentPosition
        this._timers[id] = geolocation.getCurrentPosition(options, successCallback, errorCallback);

        var failCallback = function(error) {
            clearTimeout(geolocation._timers[id].timer);
            if (errorCallback)
                errorCallback(error);
        };

        var winCallback = function(position) {
            clearTimeout(geolocation._timers[id].timer);
            if (options.timeout !== Infinity) {
                geolocation._timers[id].timer = geolocation._createTimeout(failCallback, options.timeout);
            }
            geolocation.lastPosition = position;
            if (successCallback)
                successCallback(position);
        };

        RBCBridge.exec("geolocation", "addWatch", {"options":options, "id":id}, winCallback, failCallback, geolocation._convertOut);

        return id;
    },

    clearWatch:function(id) {
        if (id && geolocation._timers[id] !== undefined) {
            clearTimeout(geolocation._timers[id].timer);
            geolocation._timers[id].timer = false;
            RBCBridge.exec("geolocation", "clearWatch", {"id":id});
        }
    },

    _prepareOptions: function(options) {
        var opt = {
            maximumAge: 0,
            enableHighAccuracy: false,
            timeout: Infinity
        };

        if (options == null || options === undefined)
            return opt;

        if (options.maximumAge !== undefined && !isNaN(options.maximumAge) && options.maximumAge > 0) {
            opt.maximumAge = options.maximumAge;
        }
        if (options.enableHighAccuracy !== undefined) {
            opt.enableHighAccuracy = options.enableHighAccuracy;
        }
        if (options.timeout !== undefined && !isNaN(options.timeout)) {
            if (options.timeout < 0) {
                opt.timeout = 0;
            } else {
                opt.timeout = options.timeout;
            }
        }

        return opt;
    },

    _createTimeout: function(errorCallback, timeout) {
        var t = setTimeout(function() {
            clearTimeout(t);
            t = null;
            errorCallback({
                code:RBCErrors.Timeout,
                message:"Position retrieval timed out."
            });
        }, timeout);
        return t;
    },

    _convertOut: function (value)
    {
        if (value == null)
            return null;

        if (value instanceof Object)
        {
            if (value.timestamp != null && value.timestamp !== undefined)
                value.timestamp = new Date(parseFloat(value.timestamp));
        }

        return value;
    },

    _lastGeneratedId: 0,

    _timers: {},

    _getId: function ()
    {
        this._lastGeneratedId ++;
        return ""+this._lastGeneratedId;
    }
}


/***************************** messaging *****************************/


window.messaging =
{
    /*
     * options: {to: string [],
     body: string,
     attachments: string[] // array with keys from appStorage
     }
     */
    sms: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("messaging", "sms", ["options", "successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {to: string [],
     cc: string [],
     bcc: string [],
     subject: string,
     body: string,
     attachments: string[] // array with keys from appStorage
     }
     */
    email: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("messaging", "email", ["options", "successCallback", "failedCallback"], arguments);
    },

    supportAttachments: function ( successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("messaging", "supportAttachments", ["successCallback", "failedCallback"], arguments);
    }
}


/***************************** cryptography *****************************/


window.cryptography =
{
    /*
     * options: {data: string,
     hash: string}
     * hash : md5, sha1, sha-256, sha-384, sha-512
     */
    hash: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("crypto", "hash", ["options", "successCallback", "failedCallback"], arguments);
    }
}


/***************************** appStorage *****************************/


window.appStorage =
{
    /*
     * options: {
     key: string,

     // For insert simple value
     value: string,

     // For insert file content
     contentType: string,
     data: string // data in base64

     // For load file from remote server
     url: string // url
     }
     *
     * return value in successCallback:
     * info {
     key: string,
     contentType: string
     }
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    put: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("appStorage", "put", ["options", "successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {
     // Key prefix
     prefix: string,

     // For select only known contentType values
     contentType: string
     }
     *
     * return value in successCallback:
     * info {
     keys: [
     {
     key: string,
     contentType: string,
     }]
     }
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    getAllKeys: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("appStorage", "getAllKeys", ["options", "successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {
     // For get 1 key
     key: string,

     // For get many keys in one command
     keys: string[],

     // For select only known contentType values
     contentType: string
     }
     *
     * return value in successCallback:
     * info {
     values: [
     {
     key: string,
     contentType: string,

     // For text values
     value: string

     // For binary values
     data: string // data in base64
     }]
     }
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    get: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("appStorage", "get", ["options", "successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {
     // For delete 1 key
     key: string,

     // For delete many keys in one command
     keys: string[],
     }
     *
     * return value in successCallback: null
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    delete: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("appStorage", "delete", ["options", "successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {
     // Key prefix
     prefix: string,

     // For select only known contentType values
     contentType: string
     }
     *
     * return value in successCallback: null
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    deleteAll: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("appStorage", "deleteAll", ["options", "successCallback", "failedCallback"], arguments);
    },

    /***************************** Strings Methods ******************************/

    putString: function ( key, value, successCallback, errorCallback)
    {
        var options = {"key": key, "value": value, "contentType":"text/plain"};

        return this.put( options, successCallback, errorCallback);
    },

    getString: function ( key, successCallback, errorCallback )
    {
        var options = {"key": key};

        return this.get( options, successCallback, errorCallback);
    },

    getStrings: function ( keys, successCallback, errorCallback )
    {
        var options = {"keys": keys};

        return this.get( options, successCallback, errorCallback);
    },

    /***************************** Content Methods Methods ******************************/

    /*
     * key: string
     * contentType: string
     * data: string // data in base64
     *
     */
    putContent: function ( key, contentType, data, successCallback, errorCallback )
    {
        var options = {"key": key, "data": data, "contentType":contentType};

        return this.put( options, successCallback, errorCallback);
    },

    loadContent: function ( key, url, successCallback, errorCallback )
    {
        var options = {"key": key, "url": url};

        return this.put( options, successCallback, errorCallback);
    },

    getContent: function ( key, successCallback, errorCallback )
    {
        return this.get( {"key": key}, successCallback, errorCallback);
    }
}


/***************************** archiving *****************************/


window.archiving =
{
    /*
     * options: {
     archive: string, // key for zip result archive file in appStorage
     password: string, // optional password for zip archive

     // Archive selected files
     files: archiveFileInfo [], // see archiveFileInfo description for more info

     // Or archive all files with prefix
     filesWithPrefix: string // prefix for zipped files in appStorage. All subprefixes will be used as subfolders.
     }
     * archiveFileInfo: {
     key: string, // key for file in appStorage
     name: string // file name with folders support. e.g. "foder1/file1.txt"
     }
     * return value in successCallback: null
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    zip: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("archiving", "zip", ["options", "successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {
     archive: string, // key for zip archive file in appStorage
     password: string, // optional password for zip archive

     prefix: string // prefix for unzipped files in appStorage
     }
     * For example zip file contains:
     * zip
     *  |-->file1.txt
     *  |-->folder1
     *          |-->file1.txt
     * After unzipping will be created keys:
     * 1. prefix/file1.txt
     * 2. prefix/folder1/file1.txt
     *
     * return value in successCallback:
     * info {
     keys: string [] // List of unzipped keys in appStorage
     }
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    unzip: function ( options, successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("archiving", "unzip", ["options", "successCallback", "failedCallback"], arguments);
    }
}


/***************************** printing *****************************/


window.printing =
{
    OutputType: {
        GENERAL: 0,     // B&W or color, normal quality output for mixed text, graphics, and images
        PHOTO: 1,       // B&W or color, best quality output for images
        GRAYSCALE: 2	// B&W content only
    },

    Orientation: {
        PORTRAIT: 0,
        LANDSCAPE: 1
    },

    Duplex: {
        NONE: 0,
        LONG_EDGE: 1,       // flip back page along long edge (same orientation in portrait, flipped for landscape)
        SHORT_EDGE: 2,      // flip back page along short edge (flipped orientation for portrait, same in landscape)
    },

    supported: false,

    /*
     * return value in successCallback:
     * contentTypes: string[]
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    getSupportedContentTypes: function ( successCallback, errorCallback )
    {
        return RBCBridge.execWithArguments("printing", "getSupportedContentTypes", ["successCallback", "failedCallback"], arguments);
    },

    /*
     * options: {
     key: string, // print file with key from appStorage,

     // Optional
     outputType: printing.OutputType,
     orientation: printing.Orientation,
     duplex: printing.Duplex,
     showsPageRange: true/false
     }
     *
     * return value in successCallback: null
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    print: function (options, successCallback, errorCallback)
    {
        return RBCBridge.execWithArguments("printing", "print", ["options", "successCallback", "failedCallback"], arguments);
    }
};

RBCBridge.loadParameters("printing", ["supported"], function (parameters) {
    if (parameters.printing != null && parameters.printing !== undefined)
        printing.supported = parameters.printing.supported;
    else
        printing.supported = false;
});


/***************************** lookAt *****************************/


window.lookAt =
{
    /*
     * options: {
     url: string
     }
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    browser: function ( options, errorCallback )
    {
        return RBCBridge.exec("lookAt", "browser", {"options":options}, null, errorCallback);
    },

    /*
     * options: {
     // Developer can open map with location coordinates
     coordinates: {
     latitude:double,
     longitude:double
     },

     // Or can simple find coordinates by address
     address: string
     }
     * tip: Not all devices support geocoding. If map called with address options and geocoding not supported will be called errorCallback
     * return value in errorCallback:
     * error {
     code: int,
     message: string
     }
     */
    map: function ( options, errorCallback )
    {
        return RBCBridge.exec("lookAt", "map", {"options":options}, null, errorCallback);
    }
}


/***************************** testing *****************************/


window.testing =
{
    crash: function ( message )
    {
        return RBCBridge.execWithArguments("testing", "crash", ["message"], arguments);
    }
}
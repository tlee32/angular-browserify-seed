/***************************** rbcBridgeKernel *****************************/


var RBCBridgePlatforms =
{
    UNKNOWN : 0,
    IOS     : 1,
    ANDROID : 2,
    WP      : 3,
    WIN8_1  : 4
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
        else if (platform === 'w8_1')
            this.platform = RBCBridgePlatforms.WIN8_1;
        else
            return;

        if (this.preloadParameters != null)
        {
            // Load parameters
            this.exec("internal", "getParameters", this.preloadParameters, function(parameters)
            {
                for (var module in parameters)
                {
                    var values = parameters[module];
                    var callback = RBCBridge.preloadCallbacks[module];

                    if (callback)
                    {
                        var result = new Object();
                        result[module] = values;

                        callback(result);
                    }
                }

                RBCBridge.preloadParameters = null;
                RBCBridge.preloadCallbacks = null;

                setTimeout(function() {
                                RBCBridge._initilizationFinished();
                        }, 0);
            }, null, null, true);

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

    exec: function ( moduleName, functionName, parameters, successCallback, failedCallback, convertOut, sendAnyway )
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

        if ((this.state == RBCBridgeStates.NOT_INITIALIZED ||
             this.state == RBCBridgeStates.WAIT_PARAMETERS) && (sendAnyway !== true))
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

        var isWinPlatforms = (this.platform == RBCBridgePlatforms.WP || this.platform == RBCBridgePlatforms.WIN8_1);

        var callUrl = this.buildCallUrl(universalModuleName, universalFunctionName, callInfo.callId, universalParameters, isWinPlatforms);

        if (isWinPlatforms)
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
        setTimeout(function() {
                                RBCBridge._iosNativeCallReceived();
                        }, 0);
    },

    _iosNativeCallReceived: function()
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
        setTimeout(function() {
                            var callInfo = RBCBridge.nativeCalls[callId];

                            if (callInfo == null ||
                                callInfo === undefined)
                                return;

                            if (status != false)
                                callInfo.promise.finishedSuccessfully((callInfo.convertOut == null) ? response : callInfo.convertOut(response));
                            else
                                callInfo.promise.finishedWithError(response);

                            if (status === true || status == false)
                                delete RBCBridge.nativeCalls[callId];
                        }, 0);
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
	TYPES: {
        PHONE: "phone",
        TABLET: "tablet"
    },

	model: null,
	platform: null,
	uuid: null,
	version: null,
	name: null,
	type: null,
	appVersion: null,
	appBuild: null,

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

RBCBridge.loadParameters("device", ["model", "platform", "uuid", "version", "name", "type", "appVersion", "appBuild"], function (parameters) {
	if (parameters && parameters.device)
	{
		for (var key in parameters.device) {
  			if (parameters.device.hasOwnProperty(key)) {
  				device[key] = parameters.device[key];
  			}
		}
	}
});


/***************************** deviceOrientation *****************************/


window.deviceOrientation =
{
	MODE: {
        AUTO: "auto",
        PORTRAIT: "portrait",
        LANDSCAPE: "landscape"
    },

	setOrientation: function ( orientation, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("orientation", "setOrientation", ["orientation", "successCallback", "failedCallback"], arguments);
	}
}


/***************************** connection *****************************/


var RBCConnectionMonitor = function() {
    this.id = null;
    this.url = null;
    this.available = false;

    this._availableCallbacks = [];
};

RBCConnectionMonitor.prototype.stop = function(successCallback, errorCallback) {
    var monitor = this;

    return RBCBridge.exec("connection", "stopMonitoring", {
        "monitorId": monitor.id
    }, function() {
        window.connection._closeConnectionMonitor(monitor);
        if (successCallback != null && successCallback !== undefined)
            successCallback();
    }, errorCallback);
};

RBCConnectionMonitor.prototype.onAvailableChanged = function(callback) {
    this._availableCallbacks.push(callback);
    return this;
};

window.connection = {
    TYPES: {
        UNKNOWN: "unknown",
        ETHERNET: "ethernet",
        WIFI: "wifi",
        CELL_2G: "2g",
        CELL_3G: "3g",
        CELL_4G: "4g",
        CELL: "cellular",
        NONE: "none"
    },

    STATES: {
        UNKNOWN: "unknown",
        ONLINE: "online",
        OFFLINE: "offline"
    },

    type: "unknown",
    state: "unknown",

    /*
     * options: {
                    url: string, // optional server page. if not defined used default server

                    timeout: int, // in milliseconds. Optional ping timeout. If not defined = 30 seconds
                }
     *
     * return value in successCallback:
     * info {
                monitor: RBCConnectionMonitor object
            }
     * return value in errorCallback:
     * error {
                code: int,
                message: string
             }
     */
    startMonitoring: function(options, successCallback, errorCallback) {
        var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);

        successCallback = preparedArguments.successCallback;
        errorCallback = preparedArguments.failedCallback;

        var winCallback = function(info) {
            if (info.monitorId == null || info.monitorId === undefined)
                return;

            var connectionMonitor = new RBCConnectionMonitor();
            connectionMonitor.id = info.monitorId;
            connectionMonitor.url = info.url;
            connectionMonitor.available = info.available || false;

            if (connection._connectionMonitors.length == 0) {
                events.addEventListener("connection.monitorAvailableChanged", connection._onMonitorAvailableChanged);
            }

            connection._connectionMonitors.push(connectionMonitor);

            setTimeout(function() {
                successCallback({
                    "monitor": connectionMonitor
                });
            }, 0);
        };

        return RBCBridge.exec("connection", "startMonitoring", preparedArguments.parameters, winCallback, errorCallback);
    },

    isOnline: function() {
        return (this.state == "online");
    },

    typeChanged: function(callback) {
        events.addEventListener("connection.type", callback);

        return this;
    },

    stateChanged: function(callback) {
        events.addEventListener("connection.state", callback);

        return this;
    },

    _connectionMonitors: [],

    _closeConnectionMonitor: function(monitor) {
        var itemIndex = this._connectionMonitors.indexOf(monitor);
        if (itemIndex > -1)
            this._connectionMonitors.splice(itemIndex, 1);

        if (this._connectionMonitors.length == 0) {
            events.removeEventListener("connection.monitorAvailableChanged", connection._onMonitorAvailableChanged);
        }
    },

    _onMonitorAvailableChanged: function(info) {
        var id = info.monitorId;
        for (var i = 0; i < connection._connectionMonitors.length; i++) {
            var monitor = connection._connectionMonitors[i];
            if (monitor.id == id) {
                monitor.available = info.available;

                var callbacksCount = monitor._availableCallbacks.length;
                for (var i = 0; i < callbacksCount; i++) {
                    try {
                        monitor._availableCallbacks[i]({
                            "available": monitor.available
                        });
                    } catch (e) {

                    }
                }

                break;
            }
        }
    }
}

RBCBridge.loadParameters("connection", ["state", "type"], function(parameters) {
    connection.state = parameters.connection.state;
    connection.type = parameters.connection.type;
});

connection.typeChanged(function(info) {
    connection.type = info.type;
}).stateChanged(function(info) {
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


/***************************** authentication *****************************/


window.authentication =
{
	// For the first time
	supported: false,

	username: null,
	authenticated: false,

	/*
	 * options: {
					username: string,
					password: string,
					remember: true/false
	 			}
	 *
	 * return value in successCallback:
	 * info {
				username: string
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	login: function ( options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("authentication", "login", ["options", "successCallback", "failedCallback"], arguments);
	},

	/*
	 * return value in successCallback: null
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	logout: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("authentication", "logout", ["successCallback", "failedCallback"], arguments);
	},

	/*
	 * return value in successCallback:
	 * info {
				username: string,
				remember: true/false
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getCredentialsInfo: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("authentication", "getCredentialsInfo", ["successCallback", "failedCallback"], arguments);
	}
};

RBCBridge.loadParameters("authentication", ["supported", "username"], function (parameters) {
	if (parameters.authentication != null && parameters.authentication !== undefined &&
		parameters.authentication.username != null && parameters.authentication.username !== undefined)
	{
		authentication.username = parameters.authentication.username;
		authentication.authenticated = true;
	}
	else
	{
		authentication.username = null;
		authentication.authenticated = false;
	}

	if (parameters.authentication != null && parameters.authentication !== undefined)
		authentication.supported = parameters.authentication.supported;
	else
		authentication.supported = false;
});

events.addEventListener("authentication.usernameChanged", function(info) {
	if (info.username != null && info.username !== undefined)
	{
		authentication.username = info.username;
		authentication.authenticated = true;
	}
	else
	{
		authentication.username = null;
		authentication.authenticated = false;
	}
});


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

    showToast : function ( message, duration, position, errorCallback ) 
    {
            return RBCBridge.execWithArguments("notifications", "showToast", ["message","duration","position","failedCallback"], arguments);
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
};

RBCBridge.loadParameters("notifications", ["replaceSystemAlert"], function (parameters) {
	if (parameters.notifications.replaceSystemAlert === true)
	{
		 window.alert = function (message) {

		 	notifications.alert(null, message, "OK");
		 	
		 };
	}
});


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


/***************************** calendar *****************************/


window.calendar =
{
	/*
		calendarItem: {
						id:"",
					  	title:"",
					  	type:"", // local, calDAV, exchange, subscription, birthday
					  	allowsModifications: true/false
					  }

		recurrenceRuleItem: {
								frequency:"", // daily, weekly, monthly, yearly
								interval:Int, // value which specifies how often the recurrence rule repeats
                    over the unit of time described by the frequency.
                    			daysOfTheWeek: string[], // mo,tu,we,th,fr,sa,su. Valid for all frequency types except daily.
                    			daysOfTheMonth: int[], // An array of int ([+/-] 1 to 31). Valid only for monthly frequency. 
                    			monthsOfTheYear: int[], // An array of int (1 to 12). Valid only for yearly frequency.
                    			weeksOfTheYear: int[], // An array of int ([+/1] 1 to 53). Valid only for yearly frequency.
                    			daysOfTheYear: int[], // An array of int ([+/1] 1 to 366). Valid only for yearly frequency.
                    			
                    			endDate: Date, // Recurrence end with a specific end date.
                    			// OR
								occurrenceCount: int, // Recurrence end with a maximum occurrence count.
							}

		eventItem: {
						id:"",
						title:"",
						location:"",
						notes:"",
						url:"",
						alarm: {
							date: Date, // Absolute trigger time.
							// OR
							offset: Int, // Offset before start date
						},
						calendarId:"", // use calendar.getCalendarById to get calendarItem
						startDate:Date,
						endDate:Date,
						availability:"", // notSupported, busy, free, tentative, unavailable
						status:"", // none, confirmed, tentative, canceled,
						recurrenceRules: recurrenceRuleItem[]
				   }
    */

    /*
	 * return value in successCallback:
	 * info {
				calendars: calendarItem[]
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getCalendars: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("calendar", "getCalendars", ["successCallback", "failedCallback"], arguments);
	},

	/*
	 * calendarId - string. Identifier of calendar item
	 * return value in successCallback:
	 * info {
				calendars: calendarItem[]
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getCalendarById: function ( calendarId, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("calendar", "getCalendarById", ["calendarId", "successCallback", "failedCallback"], arguments);
	},

    /*
	 * options: {
	 			 startDate: Date, // The start date
	 			 endDate: Date, // The end date.
	 			 calendars: string[], // Array with calendar ids. If null returned event in all calendars
	 			}

	 * return value in successCallback:
	 * info {
				events: eventItem[]
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getEvents: function (options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("calendar", "getEvents", ["options","successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
	},

	/*
	 * eventId - string. Identifier of event item
	 * return value in successCallback:
	 * info {
				events: eventItem[]
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getEventById: function ( eventId, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("calendar", "getEventById", ["eventId", "successCallback", "failedCallback"], arguments, null, this._convertOut);
	},

	/*
	 * event - eventItem. New event item
	 * return value in successCallback:
	 * info {
				events: eventItem[]
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	create: function ( event, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("calendar", "createEvent", ["event", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
	},

	/*
	 * event - eventItem. Exist event item to delete. Used only event.id.
	 * return value in successCallback: null
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	delete: function ( event, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("calendar", "deleteEvent", ["event", "successCallback", "failedCallback"], arguments, this._convertIn, this._convertOut);
	},

	/************* Internal Methods *************/
	_convertIn: function (parameterName, value)
	{
		if (parameterName == "options")
		{
			var startDate = value.startDate;
			if (startDate != null && startDate instanceof Date)
				value.startDate = startDate.getTime();

			var endDate = value.endDate;
			if (endDate != null && endDate instanceof Date)
				value.endDate = endDate.getTime();
		}else if (parameterName == "event")
		{
			var startDate = value.startDate;
			if (startDate != null && startDate instanceof Date)
				value.startDate = startDate.getTime();

			var endDate = value.endDate;
			if (endDate != null && endDate instanceof Date)
				value.endDate = endDate.getTime();

			var alarm = value.alarm;
			if (alarm != null && alarm !== undefined && alarm instanceof Object)
			{
				var date = alarm.date;
				if (date != null && date instanceof Date)
					alarm.date = date.getTime();
			}

			var recurrenceRules = value.recurrenceRules;
			if (recurrenceRules != null && recurrenceRules !== undefined && recurrenceRules instanceof Array)
			{
				for (var i = 0; i < recurrenceRules.length; i++)
            	{
            		var recurrenceRule = recurrenceRules[i];

					var recurrenceRuleEndDate = recurrenceRule.endDate;
					if (recurrenceRuleEndDate != null && recurrenceRuleEndDate instanceof Date)
						recurrenceRule.endDate = recurrenceRuleEndDate.getTime();
            	}
			}
		}

		return value;
	},

	_convertOut: function (value)
	{
		if (value == null)
			return null;

		if (value instanceof Object)
		{
			if (value.events != null)
			{
				for (var i = 0; i < value.events.length; i++)
            	{
            		var eventItem = value.events[i];

            		if (eventItem.startDate != null && eventItem.startDate !== undefined)
            			eventItem.startDate = new Date(parseFloat(eventItem.startDate));
            		if (eventItem.endDate != null && eventItem.endDate !== undefined)
            			eventItem.endDate = new Date(parseFloat(eventItem.endDate));

            		var alarm = eventItem.alarm;
            		if (alarm != null && alarm !== undefined && alarm instanceof Object)
					{
            			if (alarm.date != null && alarm.date !== undefined)
            				alarm.date = new Date(parseFloat(alarm.date));
					}

					var recurrenceRules = eventItem.recurrenceRules;
					if (recurrenceRules != null && recurrenceRules !== undefined && recurrenceRules instanceof Array)
					{
						for (var j = 0; j < recurrenceRules.length; j++)
		            	{
		            		var recurrenceRule = recurrenceRules[j];

		            		if (recurrenceRule.endDate != null && recurrenceRule.endDate !== undefined)
            					recurrenceRule.endDate = new Date(parseFloat(recurrenceRule.endDate));
		            	}
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


/***************************** audio *****************************/


var RBCAudioItemState = {
  STOPPED: 0,
  PLAYING: 1,
  PAUSED: 2,
  RECORDED: 3,
  INTERRUPTER: 4
};

var RBCAudioItem = function() {
  this.itemId = null;
  this.key = null;
  this.state = RBCAudioItemState.STOPPED;
  this.duration = 0;
  this.position = 0;

  this._stateCallbacks = [];
  this._durationCallbacks = [];
  this._positionCallbacks = [];
};

RBCAudioItem.prototype.close = function(successCallback, errorCallback) {
  this._stateCallbacks = [];
  this._durationCallbacks = [];
  this._positionCallbacks = [];

  audio._closeAudioItem(this);

  return RBCBridge.exec("audio", "close", {
    "audioId": this.itemId
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.getDuration = function(successCallback, errorCallback) {
  var audioId = this.itemId;
  return RBCBridge.exec("audio", "getDuration", {
    "audioId": this.itemId
  }, function(info) {
    audio._onProgressChanged({
      audioId: audioId,
      duration: info.duration
    });

    if (successCallback != null && successCallback !== undefined)
      successCallback(info);
  }, errorCallback);
};

RBCAudioItem.prototype.startPlaying = function(successCallback, errorCallback) {
  return RBCBridge.exec("audio", "startPlaying", {
    "audioId": this.itemId
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.stopPlaying = function(successCallback, errorCallback) {
  return RBCBridge.exec("audio", "stopPlaying", {
    "audioId": this.itemId
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.pausePlaying = function(successCallback, errorCallback) {
  return RBCBridge.exec("audio", "pausePlaying", {
    "audioId": this.itemId
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.seekTo = function(position, successCallback, errorCallback) {
  return RBCBridge.exec("audio", "seekTo", {
    "audioId": this.itemId,
    "position": position
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.startRecording = function(successCallback, errorCallback) {
  return RBCBridge.exec("audio", "startRecording", {
    "audioId": this.itemId
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.stopRecording = function(successCallback, errorCallback) {
  return RBCBridge.exec("audio", "stopRecording", {
    "audioId": this.itemId
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.setVolume = function(volume, successCallback, errorCallback) {
  return RBCBridge.exec("audio", "setVolume", {
    "audioId": this.itemId,
    "volume": volume
  }, successCallback, errorCallback);
};

RBCAudioItem.prototype.onStateChanged = function(callback) {
  this._stateCallbacks.push(callback);
  return this;
};

RBCAudioItem.prototype.onDurationChanged = function(callback) {
  this._durationCallbacks.push(callback);
  return this;
};

RBCAudioItem.prototype.onPositionChanged = function(callback) {
  this._positionCallbacks.push(callback);
  return this;
};

window.audio = {
  _audioItems: [],
  /*
   * options fields: {key: string}
   */
  getAudio: function(options, successCallback, errorCallback) {
    var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);

    successCallback = preparedArguments.successCallback;
    errorCallback = preparedArguments.failedCallback;

    var winCallback = function(info) {
      if (info.audioId == null || info.audioId === undefined)
        return;

      var audioItem = new RBCAudioItem();
      audioItem.itemId = info.audioId;
      audioItem.key = info.key;

      if (audio._audioItems.length == 0) {
        events.addEventListener("audio.state", audio._onStateChanged);
        events.addEventListener("audio.progress", audio._onProgressChanged);
      }

      audio._audioItems.push(audioItem);

      setTimeout(function() {
        successCallback({
          "audioItem": audioItem
        });
      }, 0);
    };

    return RBCBridge.exec("audio", "getAudio", preparedArguments.parameters, winCallback, errorCallback);
  },

  _closeAudioItem: function(audioItem) {
    var itemIndex = this._audioItems.indexOf(audioItem);
    if (itemIndex > -1)
      this._audioItems.splice(itemIndex, 1);

    if (this._audioItems.length == 0) {
      events.removeEventListener("audio.state", audio._onStateChanged);
      events.removeEventListener("audio.progress", audio._onProgressChanged);
    }
  },

  _onStateChanged: function(info) {
    var id = info.audioId;
    for (var i = 0; i < audio._audioItems.length; i++) {
      var item = audio._audioItems[i];
      if (item.itemId == id) {
        item.state = info.state;

        var callbacksCount = item._stateCallbacks.length;
        for (var i = 0; i < callbacksCount; i++) {
          try {
            item._stateCallbacks[i]({
              "state": item.state
            });
          } catch (e) {

          }
        }

        break;
      }
    }
  },

  _onProgressChanged: function(info) {
    var id = info.audioId;
    for (var i = 0; i < audio._audioItems.length; i++) {
      var item = audio._audioItems[i];
      if (item.itemId == id) {
        if (info.duration != null && info.duration !== undefined && item.duration != info.duration) {
          item.duration = info.duration;

          var callbacksCount = item._durationCallbacks.length;
          for (var i = 0; i < callbacksCount; i++) {
            try {
              item._durationCallbacks[i]({
                "duration": item.duration
              });
            } catch (e) {

            }
          }
        }

        if (info.position != null && info.position !== undefined && item.position != info.position) {
          item.position = info.position;

          var callbacksCount = item._positionCallbacks.length;
          for (var i = 0; i < callbacksCount; i++) {
            try {
              item._positionCallbacks[i]({
                "position": item.position
              });
            } catch (e) {

            }
          }
        }

        break;
      }
    }
  }
};


/***************************** geofencing *****************************/


window.geofencing =
{
	supported: false,

	/*
	 * regionItem: {id: string,
	 				name: string,
	 				center: {
	 					latitude:double,
	 					longitude:double,
	 				},
	 				radius:double,
	 				notifications: {
						enter: {
							"title": string,
							"message": string,
							"url": string
						},
						exit: {
							"title": string,
							"message": string,
							"url": string
						}
	 				}
	 				}
	 */

	/*
	 * return value in successCallback:
	 * info {
				regions: regionItem []
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getRegions: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("geofencing", "getRegions", ["successCallback", "failedCallback"], arguments);
	},

	/*
	 * return value in successCallback:
	 * info {
				region: regionItem
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	addRegion: function (regionItem, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("geofencing", "addRegion", ["regionItem", "successCallback", "failedCallback"], arguments);
	},

	checkRegion: function (regionItem, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("geofencing", "checkRegion", ["regionItem", "successCallback", "failedCallback"], arguments);
	},

	removeRegion: function (regionItem, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("geofencing", "removeRegion", ["regionItem", "successCallback", "failedCallback"], arguments);
	},

	removeAllRegions: function (successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("geofencing", "removeAllRegions", ["successCallback", "failedCallback"], arguments);
	},

	getPageRegion: function (successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("geofencing", "getPageRegion", ["successCallback", "failedCallback"], arguments);
	}
};

RBCBridge.loadParameters("geofencing", ["supported"], function (parameters) {
	if (parameters.geofencing)
		geofencing.supported = parameters.geofencing.supported || false;
	else
		geofencing.supported = false;
});


/***************************** geolocation *****************************/


window.geolocation =
{
	/*
	 * coordinatesItem: {latitude:double,
	 					 longitude:double,
	 					 accuracy:double,
	 					 altitude:double,
	 					 altitudeAccuracy:double,
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

        var failCallback = function(error) {
            if (errorCallback)
                errorCallback(error);
        };

        var winCallback = function(position) {
            geolocation.lastPosition = position;
            if (successCallback)
            	successCallback(position);
        };

        RBCBridge.exec("geolocation", "addWatch", {"options":options, "id":id}, winCallback, errorCallback, geolocation._convertOut);

        return id;
    },

    clearWatch:function(id) {
        if (id) {
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


/***************************** accelerometer *****************************/


window.accelerometer =
{
	/*
	 * accelerationItem: {x:double,
	 					  y:double,
	 					  z:double,
                          timestamp: Date}
	 */


    /*
    * options: {
                updateInterval: number,
             }
    *
    * return value in successCallback:
    * info = accelerationItem
    * return value in errorCallback:
    * error {
            code: int,
            message: string
         }
    */
    getCurrentAcceleration: function(options, successCallback, errorCallback) {
        var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);

        options = preparedArguments.parameters.options;
        successCallback = preparedArguments.successCallback;
        errorCallback = preparedArguments.failedCallback;

        var watchId = null;

        var winCallback = function(acceleration)
        {
            window.accelerometer.clearWatch(watchId);

            if (successCallback)
	            successCallback(acceleration);
        };
        var failCallback = function(error)
        {
            window.accelerometer.clearWatch(watchId);

            if (errorCallback)
                errorCallback(error);
        };

        watchId = this.watchAcceleration(options, winCallback, failCallback);
    },

    /*
    * options: {
                updateInterval: number,
             }
    *
    * return value in successCallback:
    * info = accelerationItem
    * return value in errorCallback:
    * error {
            code: int,
            message: string
         }
    */
    watchAcceleration:function(options, successCallback, errorCallback) {
        var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);

        options = preparedArguments.parameters.options;
        successCallback = preparedArguments.successCallback;
        errorCallback = preparedArguments.failedCallback;

        var id = this._getId();

        RBCBridge.exec("accelerometer", "addWatch", {"options":options, "id":id}, successCallback, errorCallback, geolocation._convertOut);

        return id;
    },

    /*
    * id - identifier of watchAcceleration
    */
    clearWatch:function(id) {
        if (id) {
            RBCBridge.exec("accelerometer", "clearWatch", {"id":id});
        }
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

	_getId: function ()
    {
    	this._lastGeneratedId ++;
    	return ""+this._lastGeneratedId;
    }
};


/***************************** shakeDetector *****************************/


window.shakeDetector =
{
    startWatch: function(onDetectCallback, errorCallback) {
        var preparedArguments = RBCBridge.prepareArguments(["successCallback", "failedCallback"], arguments);

        successCallback = preparedArguments.successCallback;
        errorCallback = preparedArguments.failedCallback;

        if (window.accelerometer === undefined)
        {
            if (errorCallback)
                errorCallback({code:1, message:"shakeDetector module can not work without accelerometer"});

            return;
        }

        var counter = 0;
        var firstMovTime = 0;

        var winCallback = function(acceleration)
        {
            var maxAcc = acceleration.x*acceleration.x+acceleration.y*acceleration.y+acceleration.z*acceleration.z;
            if (maxAcc >= 5) {
                if (counter == 0) {
                    counter++;
                    firstMovTime = (new Date()).getTime();
                } else {
                    var nowTime = (new Date()).getTime();
                    if ((nowTime - firstMovTime) < 700)
                        counter++;
                    else {
                        firstMovTime = nowTime;
                        counter=1;
                        return;
                    }

                    if (counter >= 2)
                    {
                        counter = 0;

                        if (successCallback)
                            successCallback();
                    }
                }
            }
        };

        return window.accelerometer.watchAcceleration({ updateInterval: 200 }, winCallback, errorCallback);
    },

    stopWatch: function(id) {
        return window.accelerometer.clearWatch(id);
    }
};

RBCBridge.loadParameters("shakeDetector", ["detectInternal"], function (parameters) {
    if (parameters && parameters.shakeDetector && parameters.shakeDetector.detectInternal)
    {
        shakeDetector._detectShakeInternal = true;
        shakeDetector._detectShakeCallbacks = {};
        shakeDetector._lastGeneratedId = 0;
        shakeDetector._getId = function ()
        {
            this._lastGeneratedId ++;
            return ""+this._lastGeneratedId;
        };
        shakeDetector._onShakeDetected = function ()
        {
            for(var key in shakeDetector._detectShakeCallbacks) {
                if (shakeDetector._detectShakeCallbacks.hasOwnProperty(key)) {
                    var callback = shakeDetector._detectShakeCallbacks[key];
                    callback();
                }
            }
        };
        shakeDetector.startWatch = function(onDetectCallback, errorCallback) {
            var id = this._getId();

            var hasObservers = false;
            for(var key in shakeDetector._detectShakeCallbacks) {
                if (shakeDetector._detectShakeCallbacks.hasOwnProperty(key)) {
                    hasObservers = true;
                    break;
                }
            }

            if (onDetectCallback != null && onDetectCallback !== undefined)
                shakeDetector._detectShakeCallbacks[id] = onDetectCallback;

            if (!hasObservers)
            {
                events.addEventListener("shakeDetector.shakeDetected", shakeDetector._onShakeDetected);
            }

            return id;
        };
        shakeDetector.stopWatch = function(id)
        {
            if (!id)
                return;

            if (!shakeDetector._detectShakeCallbacks.hasOwnProperty(id))
                return;

            delete shakeDetector._detectShakeCallbacks[id];
            for(var key in shakeDetector._detectShakeCallbacks) {
                if (shakeDetector._detectShakeCallbacks.hasOwnProperty(key)) {
                    return;
                }
            }

            events.removeEventListener("shakeDetector.shakeDetected", shakeDetector._onShakeDetected);
        };
    }
});


/***************************** compass *****************************/


window.compass =
{
	/*
	 * headingItem: {heading:double, // Universal heading value. Equal to magneticHeading or trueHeading
	 				 magneticHeading:dobule, // Only if device supported
                     trueHeading:double,     // Only if device supported
	 				 timestamp: Date}
	 */

    watchHeading:function(successCallback, errorCallback) {
        var id = this._getId();

        RBCBridge.exec("compass", "addWatch", {"id":id}, successCallback, errorCallback, this._convertOut);

        return id;
    },

    clearWatch:function(id) {
        if (id) {
            RBCBridge.exec("compass", "clearWatch", {"id":id});
        }
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


function RBCAppStorage(shared)
{
	this.__shared = shared;

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
	this.put = function ( options, successCallback, errorCallback )
	{
        var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);
        var parameters = preparedArguments.parameters;
    	if (parameters == null || parameters === undefined)
    		parameters = {};

    	parameters.shared = this.__shared;

		return RBCBridge.exec("appStorage", "put", parameters, preparedArguments.successCallback, preparedArguments.failedCallback);
	};

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
	this.getAllKeys = function ( options, successCallback, errorCallback )
	{
		var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);
        var parameters = preparedArguments.parameters;
    	if (parameters == null || parameters === undefined)
    		parameters = {};

    	parameters.shared = this.__shared;

		return RBCBridge.exec("appStorage", "getAllKeys", parameters, preparedArguments.successCallback, preparedArguments.failedCallback);
	};

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
	this.get = function ( options, successCallback, errorCallback )
	{
		var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);
        var parameters = preparedArguments.parameters;
    	if (parameters == null || parameters === undefined)
    		parameters = {};

    	parameters.shared = this.__shared;

		return RBCBridge.exec("appStorage", "get", parameters, preparedArguments.successCallback, preparedArguments.failedCallback);
	};

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
	this.delete = function ( options, successCallback, errorCallback )
	{
		var preparedArguments = RBCBridge.prepareArguments(["options", "successCallback", "failedCallback"], arguments);
        var parameters = preparedArguments.parameters;
    	if (parameters == null || parameters === undefined)
    		parameters = {};

    	parameters.shared = this.__shared;

		return RBCBridge.exec("appStorage", "delete", parameters, preparedArguments.successCallback, preparedArguments.failedCallback);
	};

	/***************************** Strings Methods ******************************/

	this.putString = function ( key, value, successCallback, errorCallback)
	{
		var options = {"key": key, "value": value, "contentType":"text/plain"};

		return this.put( options, successCallback, errorCallback);
	};

	this.getString = function ( key, successCallback, errorCallback )
	{
		var options = {"key": key};

		return this.get( options, successCallback, errorCallback);
	};

	this.getStrings = function ( keys, successCallback, errorCallback )
	{
		var options = {"keys": keys};

		return this.get( options, successCallback, errorCallback);
	};

	/***************************** Content Methods Methods ******************************/

	/*
	 * key: string
	 * contentType: string
	 * data: string // data in base64
	 *
	 */
	this.putContent = function ( key, contentType, data, successCallback, errorCallback )
	{
		var options = {"key": key, "data": data, "contentType":contentType};

		return this.put( options, successCallback, errorCallback);
	};

	this.loadContent = function ( key, url, successCallback, errorCallback )
	{
		var options = {"key": key, "url": url};

		return this.put( options, successCallback, errorCallback);
	};

	this.getContent = function ( key, successCallback, errorCallback )
	{
		return this.get( {"key": key}, successCallback, errorCallback);
	};
}

window.appStorage = new RBCAppStorage(false);
window.appStorage.shared = new RBCAppStorage(true);

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
window.appStorage.deleteAll = function ( options, successCallback, errorCallback )
{
	return RBCBridge.execWithArguments("appStorage", "deleteAll", ["options", "successCallback", "failedCallback"], arguments);
};


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


/***************************** launch *****************************/


window.launch =
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


/***************************** webview *****************************/


window.webview =
{
	present: function ( url )
	{
		return RBCBridge.execWithArguments("webview", "present", ["url"], arguments);
	},

	dismiss: function ( )
	{
		return RBCBridge.exec("webview", "dismiss");
	},

	open: function ( url )
	{
		return RBCBridge.execWithArguments("webview", "open", ["url"], arguments);
	},

	close: function ( )
	{
		return RBCBridge.exec("webview", "close");
	}
};


/***************************** mainMenu *****************************/


window.mainMenu =
{
	updateTitle: function ( title, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("mainMenu", "updateTitle", ["title", "successCallback", "failedCallback"], arguments);
	},

	addCustomItem: function ( item, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("mainMenu", "addCustomItem", ["item", "successCallback", "failedCallback"], arguments);
	},

	removeCustomItem: function ( item, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("mainMenu", "removeCustomItem", ["item", "successCallback", "failedCallback"], arguments);
	},

	removeAllCustomItems: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("mainMenu", "removeAllCustomItems", ["successCallback", "failedCallback"], arguments);
	},

	showMenu: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("mainMenu", "showMenu", ["successCallback", "failedCallback"], arguments);
	},

	bounceMenu: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("mainMenu", "bounceMenu", ["successCallback", "failedCallback"], arguments);
	}
};


/***************************** navigationBar *****************************/


window.navigationBar =
{
	show: function ( options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("navigationBar", "show", ["options", "successCallback", "failedCallback"], arguments);
	},

	hide: function ( options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("navigationBar", "hide", ["options", "successCallback", "failedCallback"], arguments);
	},

	setTitle: function ( options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("navigationBar", "setTitle", ["options", "successCallback", "failedCallback"], arguments);
	},

	setRightButton: function ( options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("navigationBar", "setRightButton", ["options", "successCallback", "failedCallback"], arguments);
	}
};


/***************************** iBeacon *****************************/


window.iBeacon =
{
	supported: false,

	/*
	 * return value in successCallback:
	 * info {
				regions: string []
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	getRegions: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "getRegions", ["successCallback", "failedCallback"], arguments);
	},

	/*
	 * options: {
	 			 uuid: string,
	 			 enter_notification: 
	 			 {
					"title": string,
					"message": string,
					"url": string
	 			 }
	 			}

	 * return value in successCallback:
	 * info {
				region: string
	 		}
	 * return value in errorCallback:
	 * error {
				code: int,
				message: string
			 }
	 */
	addRegion: function (options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "addRegion", ["options", "successCallback", "failedCallback"], arguments);
	},

	checkRegion: function (uuid, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "checkRegion", ["uuid", "successCallback", "failedCallback"], arguments);
	},

	removeRegion: function (uuid, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "removeRegion", ["uuid", "successCallback", "failedCallback"], arguments);
	},

	removeAllRegions: function (successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "removeAllRegions", ["successCallback", "failedCallback"], arguments);
	},

	addBeacon: function (options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "addBeacon", ["options", "successCallback", "failedCallback"], arguments);
	},

	getBeacons: function (successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "getBeacons", ["successCallback", "failedCallback"], arguments);
	},

	removeBeacon: function (options, successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "removeBeacon", ["options", "successCallback", "failedCallback"], arguments);
	},

	removeAllBeacons: function ( successCallback, errorCallback )
	{
		return RBCBridge.execWithArguments("iBeacon", "removeAllBeacons", ["successCallback", "failedCallback"], arguments);
	}
};

RBCBridge.loadParameters("iBeacon", ["supported"], function (parameters) {
	if (parameters.iBeacon != null && parameters.iBeacon !== undefined)
		iBeacon.supported = parameters.iBeacon.supported;
	else
		iBeacon.supported = false;
});


/***************************** nfc *****************************/


var ndef = {

    // see android.nfc.NdefRecord for documentation about constants
    // http://developer.android.com/reference/android/nfc/NdefRecord.html
    TNF_EMPTY: 0x0,
    TNF_WELL_KNOWN: 0x01,
    TNF_MIME_MEDIA: 0x02,
    TNF_ABSOLUTE_URI: 0x03,
    TNF_EXTERNAL_TYPE: 0x04,
    TNF_UNKNOWN: 0x05,
    TNF_UNCHANGED: 0x06,
    TNF_RESERVED: 0x07,


    RTD_TEXT: [0x54], // "T"
    RTD_URI: [0x55], // "U"
    RTD_SMART_POSTER: [0x53, 0x70], // "Sp"
    RTD_ALTERNATIVE_CARRIER: [0x61, 0x63], // "ac"
    RTD_HANDOVER_CARRIER: [0x48, 0x63], // "Hc"
    RTD_HANDOVER_REQUEST: [0x48, 0x72], // "Hr"
    RTD_HANDOVER_SELECT: [0x48, 0x73], // "Hs"

    record: function (tnf, type, id, payload) {


        // handle null values
        if (!tnf) { tnf = ndef.TNF_EMPTY; }
        if (!type) { type = []; }
        if (!id) { id = []; }
        if (!payload) { payload = []; }


        // convert strings to arrays
        if (!(type instanceof Array)) {
            type = nfc.stringToBytes(type);
        }
        if (!(id instanceof Array)) {
            id = nfc.stringToBytes(id);
        }
        if (!(payload instanceof Array)) {
            payload = nfc.stringToBytes(payload);
        }


        return {
            tnf: tnf,
            type: type,
            id: id,
            payload: payload
        };
    },

    textRecord: function (text, languageCode, id) {
        var payload = textHelper.encodePayload(text, languageCode);
        if (!id) { id = []; }
        return ndef.record(ndef.TNF_WELL_KNOWN, ndef.RTD_TEXT, id, payload);
    },

    uriRecord: function (uri, id) {
        var payload = uriHelper.encodePayload(uri);
        if (!id) { id = []; }
        return ndef.record(ndef.TNF_WELL_KNOWN, ndef.RTD_URI, id, payload);
    },

    absoluteUriRecord: function (uri, payload, id) {
        if (!id) { id = []; }
        if (!payload) { payload = []; }
        return ndef.record(ndef.TNF_ABSOLUTE_URI, uri, id, payload);
    },

    mimeMediaRecord: function (mimeType, payload, id) {
        if (!id) { id = []; }
        return ndef.record(ndef.TNF_MIME_MEDIA, nfc.stringToBytes(mimeType), id, payload);
    },

    smartPoster: function (ndefRecords, id) {
        var payload = [];
        if (!id) { id = []; }
        if (ndefRecords)
        {
            if (ndefRecords[0] instanceof Object && ndefRecords[0].hasOwnProperty('tnf')) {
                payload = ndef.encodeMessage(ndefRecords);
            } else {
                payload = ndefRecords;
            }
        } else {
            console.log("WARNING: Expecting an array of NDEF records");
        }
        return ndef.record(ndef.TNF_WELL_KNOWN, ndef.RTD_SMART_POSTER, id, payload);
    },

    emptyRecord: function() {
        return ndef.record(ndef.TNF_EMPTY, [], [], []);
    },

    encodeMessage: function (ndefRecords) {

        var encoded = [],
            tnf_byte,
            type_length,
            payload_length,
            id_length,
            i,
            mb, me, // messageBegin, messageEnd
            cf = false, // chunkFlag TODO implement
            sr, // boolean shortRecord
            il; // boolean idLengthFieldIsPresent


        for(i = 0; i < ndefRecords.length; i++) {


            mb = (i === 0);
            me = (i === (ndefRecords.length - 1));
            sr = (ndefRecords[i].payload.length < 0xFF);
            il = (ndefRecords[i].id.length > 0);
            tnf_byte = ndef.encodeTnf(mb, me, cf, sr, il, ndefRecords[i].tnf);
            encoded.push(tnf_byte);


            type_length = ndefRecords[i].type.length;
            encoded.push(type_length);


            if (sr) {
                payload_length = ndefRecords[i].payload.length;
                encoded.push(payload_length);
            } else {
                payload_length = ndefRecords[i].payload.length;
                // 4 bytes
                encoded.push((payload_length >> 24));
                encoded.push((payload_length >> 16));
                encoded.push((payload_length >> 8));
                encoded.push((payload_length & 0xFF));
            }


            if (il) {
                id_length = ndefRecords[i].id.length;
                encoded.push(id_length);
            }


            encoded = encoded.concat(ndefRecords[i].type);


            if (il) {
                encoded = encoded.concat(ndefRecords[i].id);
            }


            encoded = encoded.concat(ndefRecords[i].payload);
        }


        return encoded;
    },

    decodeMessage: function (bytes) {


        var bytes = bytes.slice(0), // clone since parsing is destructive
            ndef_message = [],
            tnf_byte,
            header,
            type_length = 0,
            payload_length = 0,
            id_length = 0,
            record_type = [],
            id = [],
            payload = [];


        while(bytes.length) {
            tnf_byte = bytes.shift();
            header = ndef.decodeTnf(tnf_byte);


            type_length = bytes.shift();


            if (header.sr) {
                payload_length = bytes.shift();
            } else {
                // next 4 bytes are length
                payload_length = ((0xFF & bytes.shift()) << 24) |
                    ((0xFF & bytes.shift()) << 26) |
                    ((0xFF & bytes.shift()) << 8) |
                    (0xFF & bytes.shift());
            }


            if (header.il) {
                id_length = bytes.shift();
            }


            record_type = bytes.splice(0, type_length);
            id = bytes.splice(0, id_length);
            payload = bytes.splice(0, payload_length);


            ndef_message.push(
                ndef.record(header.tnf, record_type, id, payload)
            );


            if (header.me) { break; } // last message
        }


        return ndef_message;
    },

    decodeTnf: function (tnf_byte) {
        return {
            mb: (tnf_byte & 0x80) !== 0,
            me: (tnf_byte & 0x40) !== 0,
            cf: (tnf_byte & 0x20) !== 0,
            sr: (tnf_byte & 0x10) !== 0,
            il: (tnf_byte & 0x8) !== 0,
            tnf: (tnf_byte & 0x7)
        };
    },

    encodeTnf: function (mb, me, cf, sr, il, tnf) {


        var value = tnf;


        if (mb) {
            value = value | 0x80;
        }


        if (me) {
            value = value | 0x40;
        }


        // note if cf: me, mb, li must be false and tnf must be 0x6
        if (cf) {
            value = value | 0x20;
        }


        if (sr) {
            value = value | 0x10;
        }


        if (il) {
            value = value | 0x8;
        }


        return value;
    }


};


// nfc provides javascript wrappers to the native phonegap implementation
var nfc = {

    supported: false,

    addTagDiscoveredListener: function (callback) {
        events.addEventListener("nfc.tagdiscovered", callback);
        return this;
    },


/*
    addMimeTypeListener: function (mimeType, callback) {
        events.addEventListener("nfc.mimetype", callback);
        document.addEventListener("ndef-mime", callback, false);
        cordova.exec(win, fail, "NfcPlugin", "registerMimeType", [mimeType]);
    },
*/

    addNdefListener: function (callback) {
        events.addEventListener("nfc.ndef", callback);
        return this;
    },


    addNdefFormatableListener: function (callback) {
        events.addEventListener("nfc.ndefformatable", callback);
        return this;
    },


    write: function (ndefMessage, successCallback, errorCallback) {
        return RBCBridge.execWithArguments("nfc", "writeTag", ["ndefMessage", "successCallback", "failedCallback"], arguments);
    },


    share: function (ndefMessage, successCallback, errorCallback) {
        return RBCBridge.execWithArguments("nfc", "shareTag", ["ndefMessage", "successCallback", "failedCallback"], arguments);
    },


    unshare: function (successCallback, errorCallback) {
        return RBCBridge.execWithArguments("nfc", "unshareTag", ["successCallback", "failedCallback"], arguments);
    },

    handover: function (uris, errorCallback) {
        // if we get a single URI, wrap it in an array
        if (!Array.isArray(uris)) {
            uris = [ uris ];
        }
        return RBCBridge.exec("nfc", "handover", {"uris":uris}, null, errorCallback);
    },

    stopHandover: function (errorCallback) {
        return RBCBridge.exec("nfc", "stopHandover", null, null, errorCallback);
    },


    erase: function (errorCallback) {
        return RBCBridge.exec("nfc", "eraseTag", null, null, errorCallback);
    },


    removeTagDiscoveredListener: function (callback) {
        events.removeEventListener("nfc.tagdiscovered", callback)
    },


    /*
    removeMimeTypeListener: function(mimeType, callback, win, fail) {
        events.removeEventListener("nfc.mimetype", callback)
    },
    */


    removeNdefListener: function (callback) {
        events.removeEventListener("nfc.ndef", callback)
    }

};


var util = {
    // i must be <= 256
    toHex: function (i) {
        var hex;


        if (i < 0) {
            i += 256;
        }


        hex = i.toString(16);


        // zero padding
        if (hex.length === 1) {
            hex = "0" + hex;
        }


        return hex;
    },


    toPrintable: function(i) {


        if (i >= 0x20 & i <= 0x7F) {
            return String.fromCharCode(i);
        } else {
            return '.';
        }
    },


    bytesToString: function (bytes) {
        var bytesAsString = "";
        for (var i = 0; i < bytes.length; i++) {
            bytesAsString += String.fromCharCode(bytes[i]);
        }
        return bytesAsString;
    },


    // http://stackoverflow.com/questions/1240408/reading-bytes-from-a-javascript-string#1242596
    stringToBytes: function (str) {
        var ch, st, re = [];
        for (var i = 0; i < str.length; i++ ) {
            ch = str.charCodeAt(i);  // get char
            st = [];                 // set up "stack"
            do {
                st.push( ch & 0xFF );  // push byte to stack
                ch = ch >> 8;          // shift value down by 1 byte
            } while ( ch );
            // add stack contents to result
            // done because chars have "wrong" endianness
            re = re.concat( st.reverse() );
        }
        // return an array of bytes
        return re;
    },


    bytesToHexString: function (bytes) {
        var dec, hexstring, bytesAsHexString = "";
        for (var i = 0; i < bytes.length; i++) {
            if (bytes[i] >= 0) {
                dec = bytes[i];
            } else {
                dec = 256 + bytes[i];
            }
            hexstring = dec.toString(16);
            // zero padding
            if (hexstring.length === 1) {
                hexstring = "0" + hexstring;
            }
            bytesAsHexString += hexstring;
        }
        return bytesAsHexString;
    },

    // This function can be removed if record.type is changed to a String
    /**
     * Returns true if the record's TNF and type matches the supplied TNF and type.
     *
     * @record NDEF record
     * @tnf 3-bit TNF (Type Name Format) - use one of the TNF_* constants
     * @type byte array or String
     */
    isType: function(record, tnf, type) {
        if (record.tnf === tnf) { // TNF is 3-bit
            var recordType;
            if (typeof(type) === 'string') {
                recordType = type;
            } else {
                recordType = nfc.bytesToString(type);
            }
            return (nfc.bytesToString(record.type) === recordType);
        }
        return false;
    }


};


// this is a module in ndef-js
var textHelper = {


    decodePayload: function (data) {


        var languageCodeLength = (data[0] & 0x1F), // 5 bits
            languageCode = data.slice(1, 1 + languageCodeLength),
            utf16 = (data[0] & 0x80) !== 0; // assuming UTF-16BE


        // TODO need to deal with UTF in the future
        // console.log("lang " + languageCode + (utf16 ? " utf16" : " utf8"));


        return util.bytesToString(data.slice(languageCodeLength + 1));
    },


    // encode text payload
    // @returns an array of bytes
    encodePayload: function(text, lang, encoding) {


        // ISO/IANA language code, but we're not enforcing
        if (!lang) { lang = 'en'; }


        var encoded = util.stringToBytes(lang + text);
        encoded.unshift(lang.length);


        return encoded;
    }


};


// this is a module in ndef-js
var uriHelper = {
    // URI identifier codes from URI Record Type Definition NFCForum-TS-RTD_URI_1.0 2006-07-24
    // index in array matches code in the spec
    protocols: [ "", "http://www.", "https://www.", "http://", "https://", "tel:", "mailto:", "ftp://anonymous:anonymous@", "ftp://ftp.", "ftps://", "sftp://", "smb://", "nfs://", "ftp://", "dav://", "news:", "telnet://", "imap:", "rtsp://", "urn:", "pop:", "sip:", "sips:", "tftp:", "btspp://", "btl2cap://", "btgoep://", "tcpobex://", "irdaobex://", "file://", "urn:epc:id:", "urn:epc:tag:", "urn:epc:pat:", "urn:epc:raw:", "urn:epc:", "urn:nfc:" ],


    // decode a URI payload bytes
    // @returns a string
    decodePayload: function (data) {
        var prefix = uriHelper.protocols[data[0]];
        if (!prefix) { // 36 to 255 should be ""
            prefix = "";
        }
        return prefix + util.bytesToString(data.slice(1));
    },


    // shorten a URI with standard prefix
    // @returns an array of bytes
    encodePayload: function (uri) {


        var prefix,
            protocolCode,
            encoded;


        // check each protocol, unless we've found a match
        // "urn:" is the one exception where we need to keep checking
        // slice so we don't check ""
        uriHelper.protocols.slice(1).forEach(function(protocol) {
            if ((!prefix || prefix === "urn:") && uri.indexOf(protocol) === 0) {
                prefix = protocol;
            }
        });


        if (!prefix) {
            prefix = "";
        }


        encoded = util.stringToBytes(uri.slice(prefix.length));
        protocolCode = uriHelper.protocols.indexOf(prefix);
        // prepend protocol code
        encoded.unshift(protocolCode);


        return encoded;
    }
};


// added since WP8 must call a named function
// TODO consider switching NFC events from JS events to using the PG callbacks
function fireNfcTagEvent(eventType, tagAsJson) {
    setTimeout(function () {
        var e = document.createEvent('Events');
        e.initEvent(eventType, true, false);
        e.tag = JSON.parse(tagAsJson);
        console.log(e.tag);
        document.dispatchEvent(e);
    }, 10);
}


ndef.uriHelper = uriHelper;
ndef.textHelper = textHelper;

nfc.bytesToString = util.bytesToString;
nfc.stringToBytes = util.stringToBytes;
nfc.bytesToHexString = util.bytesToHexString;

window.nfc = nfc;
window.ndef = ndef;
window.fireNfcTagEvent = fireNfcTagEvent;

RBCBridge.loadParameters("nfc", ["supported"], function (parameters) {
    if (parameters.nfc != null && parameters.nfc !== undefined)
        nfc.supported = parameters.nfc.supported;
    else
        nfc.supported = false;
});
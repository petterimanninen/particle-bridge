'use strict';


var Device = require('./device');
var querystring = require('querystring');

var IoTServer = function(baseURL) {
    this.baseURL = baseURL;

    /* Assume V2 */
    this.setVersion("v2");

    this.request = require('request').defaults({
        baseUrl: this.baseURL
    });

    var _username, _password;
    this.setPrincipal = function(username, password) {
        _username = username;
        _password = password;
    };

    var _endpoint;
    this.setEndpoint = function(endpoint) {
        _endpoint = endpoint;
    };

    /**
    * Add the auth headers to the given request.
    */
    this.getCredentials = function(request) {
        if (_endpoint) {
            return _endpoint.getCredentials(request, this);
        }
        if (_username && _password) {
            request.auth = {
                user: _username,
                pass: _password
            };
            return Promise.resolve(request);
        }
        return Promise.reject("No authentication was provider. Please use set setCredentials() or setEndpoint()");
    };

    this.checkCredentials = function(response) {
        if (_endpoint && _endpoint.hasCredentials() && response.statusCode == 401) {
            _endpoint.clearCredentials();
            return true;
        }
        return false;
    };
};

IoTServer.prototype = {
    //API
    API_URL: "/iot/api/",
    /* set by setVersion() */
    TOKEN_URL: "",
    POLICY_URL: "",
    ACTIVATION_URL: "",
    INDIRECT_DEVICE_ACTIVAITON_URL: "", /* set by constructor or setVersion */
    MESSAGES_URL: "",

    //V1
    ENDPOINTS_URL: "/iot/api/v1/endpoints",
    TOKEN_V1_URL: "/iot/api/v1/oauth2/token",
    POLICY_V1_URL: "/iot/api/v1/activation/policy",
    ACTIVATION_V1_URL: "/iot/api/v1/activation/direct",
    INDIRECT_DEVICE_ACTIVAITON_V1_URL: "/iot/api/v1/activation/indirect/device",
    MESSAGES_V1_URL: "/iot/api/v1/messages",

    //V2
    APPS_URL: "/iot/api/v2/apps",
    DEVICE_MODELS_URL: "/iot/api/v2/deviceModels",
    DEVICES_URL: "/iot/api/v2/devices",
    TOKEN_V2_URL: "/iot/api/v1/oauth2/token",
    POLICY_V2_URL: "/iot/api/v2/activation/policy",
    ACTIVATION_V2_URL: "/iot/api/v2/activation/direct",
    INDIRECT_DEVICE_ACTIVAITON_V2_URL: "/iot/api/v2/activation/indirect/device",
    MESSAGES_V2_URL: "/iot/api/v2/messages",

    CAPABILITIES: {
        direct_activation: "urn:oracle:iot:dcd:capability:direct_activation",
        indirect_activation: "urn:oracle:iot:dcd:capability:indirect_activation",
        diagnostics: "urn:oracle:iot:dcd:capability:diagnostics",
        logging: "urn:oracle:iot:dcd:capability:logging",
        message_dispatcher: "urn:oracle:iot:dcd:capability:message_dispatcher",
        power_management: "urn:oracle:iot:dcd:capability:power_management",
        software_management: "urn:oracle:iot:dcd:capability:software_management"
    },
    DEVICE_MODELS: {
      HUMIDITY_SENSOR: "urn:com:oracle:iot:device:humidity_sensor",
      TEMPERATURE_SENSOR: "urn:com:oracle:iot:device:temperature_sensor",
      LOCATION_SENSOR: "urn:com:oracle:iot:device:location_sensor",
      WEIGHT_SENSOR: "urn:com:oracle:iot:device:weight_sensor",
      AMPERAGE_SENSOR: "urn:com:oracle:iot:device:amperage_sensor",
      VOLTAGE_SENSOR: "urn:com:oracle:iot:device:voltage_sensor",
      GLOBAL_DM: "urn:thinxtra:sigfox:device:xkit",
    },

    sendRequest: function(request, expectedStatusCode, successCallback) {
        var iot = this;
        var util = require('util');
        return iot.getCredentials(request).then(function(req) {
            return new Promise(function(resolve, reject) {
                iot.request(req, function (error, response, body) {
                    if (!error && response.statusCode == expectedStatusCode) {
                        var result = successCallback ? successCallback(body) : body;
                        resolve(result);
                    } else {
                        if (iot.checkCredentials(response)) {
                            resolve(iot.sendRequest(request, expectedStatusCode, successCallback));
                        } else {
                            reject(response || error);
                        }
                    }
                });
            });
        });
    },

    provisionDevice: function(id, sharedSecret, state) {
      return new Device(id, sharedSecret, state || 'REGISTERED', this);
    },

    createGateway: function(sharedSecret, name, description, manufacturer, modelNumber, serialNumber, metadata) {
        var m = metadata || {};
        if (description) m.description = description;
        if (manufacturer) m.manufacturer = manufacturer;
        if (modelNumber) m.modelNumber = modelNumber;
        if (serialNumber) m.serialNumber = serialNumber;
        return this.createDevice(sharedSecret, name, 'SMART_DEVICE', m);
    },

    /**
    * Create a device.
    * type is ignored on v2 API.
    */
    createDevice: function(sharedSecret, name, type, metadata) {
        var iot = this;
        if (!sharedSecret) throw new Error('Shared Secret is mandatory');
        var sharedSecretBase64 = new Buffer(sharedSecret).toString('base64');
        var m = metadata || {};
        var time = new Date().getTime();
        var data = {
            type: type || 'DIRECTLY_CONNECTED_DEVICE',
            sharedSecret: sharedSecretBase64,
            endpointName: name || 'node-name'  + time,
            description: m.description || 'node-description'  + time,
            manufacturer: m.manufacturer || 'node-manufacturer'  + time,
            modelNumber: m.modelNumber || 'node-modelNumber'  + time,
            serialNumber: m.serialNumber || 'node-serialNumber'  + time
        };
        if (metadata) {
            data.metadata = {items: {}};
            for (var key in metadata) {
                if (metadata.hasOwnProperty(key) &&
                    key !== 'description' &&
                    key !== 'manufacturer' &&
                    key !== 'modelNumber' &&
                    key !== 'serialNumber') {

                    data.metadata.items[key] = metadata[key];
                }
            }
        }
        var uri = iot.ENDPOINTS_URL;
        if (iot.getVersion() === "v2") {
            uri = iot.DEVICES_URL;
            delete data.type;
            data.name = data.endpointName;
            delete data.endpointName;
            if (data.metadata) {
                var saved = data.metadata.items;
                delete data.metadata;
                data.metadata = saved;
            }
        }

        var request = {
            uri: uri,
            method: 'POST',
            json: true,
            body: data
        };

        return iot.sendRequest(request, 201, function(body) {
            return new Device(body.id, sharedSecret, body.state, iot);
        });
    },

    createDeviceModel: function(deviceModel) {
        var iot = this;
        var request = {
            uri: iot.DEVICE_MODELS_URL,
            method: 'POST',
            json: true,
            body: deviceModel
        };

        return iot.sendRequest(request, 201);
    },

    createApplication: function(name, description, deviceModels) {
        var iot = this;
        var request = {
            uri: iot.APPS_URL,
            method: 'POST',
            json: true,
            body: {
                name: name,
                description: description || 'default description'
            }
        };
        if (deviceModels) {
            if (Array.isArray(deviceModels)) {
                request.body.deviceModelURNs = deviceModels;
            } else {
                request.body.deviceModelURNs = [deviceModels];
            }
        }
        return iot.sendRequest(request, 201);
    },

    listApplications: function(query, offset, limit) {
        var iot = this;
        var qs = {};
        var request = {
            uri: iot.APPS_URL,
            qs: qs,
            method: 'GET',
            json: true
        };
//        if (query) {
//            request.uri += '&q=' + encodeURIComponent(JSON.stringify(query));
//        }
//        if (typeof offset === 'number') {
//            request.uri += '&offset=' + offset;
//        }
//        if (typeof limit === 'number') {
//            request.uri += '&limit=' + limit;
//        }
        return iot.sendRequest(request, 200);
    },

    getVersion: function() {
        return this._version;
    },

    setVersion: function(version) {
        if (version === "v1") {
            this._version = version;
            this.TOKEN_URL = this.TOKEN_V1_URL;
            this.POLICY_URL = this.POLICY_V1_URL;
            this.ACTIVATION_URL = this.ACTIVATION_V1_URL;
            this.INDIRECT_DEVICE_ACTIVAITON_URL = this.INDIRECT_DEVICE_ACTIVAITON_V1_URL;
            this.MESSAGES_URL = this.MESSAGES_V1_URL;
        } else if (version === "v2") {
            this._version = version;
            this.TOKEN_URL = this.TOKEN_V2_URL;
            this.POLICY_URL = this.POLICY_V2_URL;
            this.ACTIVATION_URL = this.ACTIVATION_V2_URL;
            this.INDIRECT_DEVICE_ACTIVAITON_URL = this.INDIRECT_DEVICE_ACTIVAITON_V2_URL;
            this.MESSAGES_URL = this.MESSAGES_V2_URL;
        }
    },

    /* Checks the IoT Version. If if can successfully resolve the version it also sets it */
    checkVersion: function() {
        var iot = this;
        var request = {
            uri: iot.API_URL,
            method: 'GET',
            json: true
        };

        return iot.sendRequest(request, 200, function(body) {
              var versions = body.items;
              var version = null;
              if (versions.length === 1) {
                  version = versions[0].version;
              } else {
                  for (var i = 0; i < versions.length; i++) {
                      var v = versions[i];
                      if (v.isLatest) {
                          version = v.version;
                      }
                  }
              }
              iot.setVersion(version);
              return version;
        });
    },

    getDevice: function(id, sharedSecret) {
        var iot = this;
        var request = {
            uri: iot.ENDPOINTS_URL + '/' + id,
            method: 'GET',
            json: true
        };

        return iot.sendRequest(request, 200, function(body) {
            return new Device(body.id, sharedSecret, body.state, iot);
        });
    },

    disableDevice: function(device) {
        var iot = this;
        var id = typeof device === "number" ? device : device.getID();
        var request = {
            uri: iot.ENDPOINTS_URL + "/" + id,
            json: true,
            method: "POST",
            headers: {
                "X-HTTP-Method-Override": "PATCH"
            },
            body: {
                state: "DISABLED"
            }
        };
        return iot.sendRequest(request, 200, function(body) {
            return device;
        });
    },

    deleteDevice: function(device) {
        var iot = this;
        var id = typeof device === "number" ? device : device.getID();
        var request = {
            uri: iot.ENDPOINTS_URL + "/" + id,
            method: "DELETE"
        };
        return iot.sendRequest(request, 204, function(body) {
            return device;
        });
    },

    listDevices: function(query, offset, limit) {
        var iot = this;
        var qs = {};
        var request = {
            uri: iot.DEVICES_URL,
            qs: qs,
            method: 'GET',
            json: true
        };
        if (query) {
            qs.q = JSON.stringify(query);
        }
        if (typeof offset === 'number') {
            qs.offset = offset;
        }
        if (typeof limit === 'number') {
            qs.limit = limit;
        }
        return iot.sendRequest(request, 200);
    },

    listEndpoints: function(query, offset, limit) {
        var iot = this;
        var request = {
            uri: iot.ENDPOINTS_URL + '?expand=metadata,resources',
            method: 'GET',
            json: true
        };
        if (query) {
            request.uri += '&q=' + encodeURIComponent(JSON.stringify(query));
        }
        if (typeof offset === 'number') {
            request.uri += '&offset=' + offset;
        }
        if (typeof limit === 'number') {
            request.uri += '&limit=' + limit;
        }
        return iot.sendRequest(request, 200);
    },

    /*
     * Options, must have exactly one of the following:
     * connector=connectorID
     * device=deviceID
     * type=type (DATA ALERT)
     *
     * can have any of:
     * since, until, offset, limit
     */
    getMessages: function(options) {
        var iot = this;
        var request = {
            uri: iot.MESSAGES_URL + '?' + querystring.stringify(options),
            method: 'GET',
            json: true
        };

        return iot.sendRequest(request, 200);
    },

    // returns the async token
    requestDeviceResource: function(deviceId, resource, data) {
        var iot = this;
        var request = {
            uri: iot.ENDPOINTS_URL + '/' + deviceId + '/resources/' + resource + '?iot.async',
            method: data ? 'PUT' : 'GET', //simplified
            json: true
        };
        if (data) {
            request.body = data;
        }

        return iot.sendRequest(request, 202);
    },

    getEndpoint: function(id, params) {
        var iot = this;
        var queryParams = '';
        if (params) {
            queryParams = '?' + querystring.stringify(params);
        }
        var request = {
            uri: iot.ENDPOINTS_URL + '/' + id + queryParams,
            method: 'GET',
            json: true
        };
        return iot.sendRequest(request, 200);
    },

    updateEndpoint: function(id, payload, patch) {
        var iot = this;
        var request = {
            uri: iot.ENDPOINTS_URL + '/' + id,
            method: 'POST',
            json: true,
            body: payload
        };
        if (patch) {
            request.headers = {};
            request.headers['X-HTTP-Method-Override'] = 'PATCH';
        }
        return iot.sendRequest(request, 200);
    }

};

module.exports = IoTServer;

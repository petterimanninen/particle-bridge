'use strict';

var crypto = require('crypto');
var uuid = require('node-uuid');
var fs = require('fs');
var path = require('path');
var util = require('util');

var sslDir = path.join(__dirname, 'ssl' );
var privateKey = fs.readFileSync(sslDir +  '/privateKey.key', 'utf8');
var publicKey = fs.readFileSync(sslDir + '/publicKey.key', 'utf8');

var Device = function(id, sharedSecret, state, iot) {
    this.id = id;
    this.sharedSecret = sharedSecret;
    this.state = state;
    this.iot = iot;

    var certificate = null;
    this.getState = function() {
        return this.state;
    };
    this.setState = function(state) {
        this.state = state;
    };
    this._loadActivation = function (body) {
        this.state = body.endpointState;
        certificate = body.certificate;
    };

    var accessToken = null;
    var tokenType = null;
    var tokenScope = null;
    this._currentTokenRequest = null;
    this._loadToken = function(body, scope) {
        tokenType = body.token_type;
        accessToken = body.access_token;
        tokenScope = scope;
    };
    this.getTokenScope = function() {
        return tokenScope;
    };
    this.getAuthorizationHeaders = function() {
        if (!tokenType) return null;
        if (this.getState() === 'ACTIVATED') {
            return {
                "Authorization": tokenType + " " + accessToken,
                "X-EndpointId": this.id
            };
        } else {
            return {
                "Authorization": tokenType + " " + accessToken,
                "X-ActivationId": this.id
            };
        }
    };

    var format = "X.509";
    var keyType = null;
    var keySize = null;
    var hashAlgorithm = null;
    this._loadActivationPolicy = function(body) {
        keyType = body.keyType;
        keySize = body.keySize;
        hashAlgorithm = body.hashAlgorithm;
    };
    this.getActivationPolicy = function() {
        if (!hashAlgorithm) return null;
        return {
            format: format,
            keyType: keyType,
            keySize: keySize,
            hashAlgorithm: hashAlgorithm
        };
    };

    this.getPublicKey = function() {
        return publicKey;
    };

    this.sign = function (buffer) {
        var sign = crypto.createSign("sha256WithRSAEncryption");
        sign.update(buffer);
        return sign.sign(privateKey, "base64");
    };
};

Device.prototype = {
    getID: function() {
        return this.id;
    },

    requestActivationToken: function() {
        var gateway = this;
        var iot = this.iot;
        return new Promise(function(resolve, reject) {
            var clientID = gateway.getID();
            var hmac = crypto.createHmac("sha256", gateway.sharedSecret);
            hmac.update(clientID + "\n" + gateway.sharedSecret);
            var hash = hmac.digest("base64");
            var formData = {
                grant_type: "client_credentials",
                client_id: clientID,
                scope: "oracle/iot/activation",
                client_secret: "HmacSHA256:" + hash
            };
            iot.request({
                    uri: iot.TOKEN_URL,
                    method: "POST",
                    json: true,
                    form: formData
                }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        gateway._loadToken(body, "oracle/iot/activation");
                        resolve(gateway);
                    } else {
                        reject(response || error);
                    }
                }
            );
        });
    },

    requestToken: function() {
        var gateway = this;
        var iot = this.iot;
        // An endpoint ID can only have a single access token at a given time.
        if (gateway._currentTokenRequest) return gateway._currentTokenRequest;
        gateway._currentTokenRequest = new Promise(function(resolve, reject) {
            var clientID = gateway.getID();
            var header = {
                typ: "JWT",
                alg: "RS256",
                cty: null
            };
            var claims = {
                iss: clientID,
                sub: null,
                aud: "oracle/iot/oauth2/token",
                exp: parseInt(new Date().getTime()/1000) + (15 * 60), // 15 minutes
                nbf: null,
                iat: 0,
                jti: null,
                typ: null
            };

            var headerBase64 = new Buffer(JSON.stringify(header)).toString("base64");
            var claimBase64 = new Buffer(JSON.stringify(claims)).toString("base64");
            var payload = headerBase64 + "." + claimBase64;
            var payloadSigned = gateway.sign(payload);

            var formData = {
                grant_type: "client_credentials",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: payload + "." + payloadSigned,
                scope: ""
            };

            iot.request({
                    uri: iot.TOKEN_URL,
                    method: "POST",
                    json: true,
                    form: formData
                }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        gateway._loadToken(body, "");
                        resolve(gateway);
                    } else {
                        reject(response || error);
                    }
                    // Not sure how reliable this is.
                    // Basically all downstream actions pending in this token
                    // should run *before* a new token can is issued (as a new
                    // token invalidates the old one)
                    gateway._currentTokenRequest = null;
                }
            );
        });
        return gateway._currentTokenRequest;
    },

    _sendMessagesRaw: function(messages, _retry) {
        var gateway = this;
        var iot = this.iot;
        var auth = gateway.getAuthorizationHeaders();
        return new Promise(function(resolve, reject) {
            iot.request({
                uri: iot.MESSAGES_URL,
                method: "POST",
                headers: auth,
                json: true,
                body: messages
            }, function (error, response, body) {
                if (response && response.statusCode == 401 && !_retry) {
                    //In case of 401, try again (one time) using a
                    //a new token
                    gateway.requestToken().then(function() {
                        gateway._sendMessagesRaw(messages, true)
                            .then(function(r) {
                                resolve(r);
                            })
                            .catch(function(r) {
                                reject(r);
                            });
                    });
                } else {
                    if (!error && response.statusCode == 202) {
                        resolve(response);
                    } else {
                        reject(response || error);
                    }
                }
            });
        });
    },

    _sendMessages: function(type, payloads, sourceID) {
        var gateway = this;
        var clientID = gateway.getID();
        var messages = payloads.map(function(payload) {
          return {
                id: uuid.v4(),
                source: sourceID || clientID,
                priority: "LOW",
                reliability: "BEST_EFFORT",
                eventTime: new Date().getTime(),
                type: type,
                payload: payload
            };
        });
        if (gateway.getAuthorizationHeaders() && gateway.getTokenScope() === "") {
            return gateway._sendMessagesRaw(messages);
        }
        return gateway.requestToken().then(function() {
            return gateway._sendMessagesRaw(messages);
        });
    },

    sendDataMessages: function(format, data, sourceID) {
console.log("JRG... in sendDataMessages");
console.log("data in"+util.inspect(data,false,null));
        var messages = [];
        var createMessage = function(itemData) {
            return {
                format: format,
                data: itemData
            };
        };
        if (Array.isArray(data)) {
            messages = data.map(createMessage);
        } else {
            messages.push(createMessage(data));
        }
console.log("message"+util.inspect(messages,false,null));
        return this._sendMessages("DATA", messages, sourceID);
    },

    //Severity: LOW(4), NORMAL(3), SIGNIFICANT(2), CRITICAL(1)
    sendAlerts: function(format, description, severity, data, sourceID) {
        var messages = [];
        var createMessage = function(itemData) {
            return {
                format: format,
                description: description,
                severity: severity,
                data: itemData
            };
        };
        if (Array.isArray(data)) {
            messages = data.map(createMessage);
        } else {
            messages.push(createMessage(data));
        }
        return this._sendMessages("ALERT", messages, sourceID);
    },

    sendResponseMessages: function(data) {
        var messages;
        if (Array.isArray(data)) {
            messages = data;
        } else {
            messages = [data];
        }
        return this._sendMessages("RESPONSE", messages);
    },

    sendResourcesReport: function(resources) {
        var messages = [{
            type: "JSON",
            value: {
                reportType: "UPDATE",
                endpointName: this.getID(),
                resources: resources
            }
        }];
        return this._sendMessages("RESOURCES_REPORT", messages);
    },

    /**
    * Indirect enroll a single device.
    * attributes might contains:
    * manufacturer String
    * productClass String
    * serialNumber String
    * hardwareId String
    * deviceModels String[]
    */
    indirectEnrollDevice: function(attributes) {
        var gateway = this;
        var iot = this.iot;
        var sendRequest = function(attrs) {
            if (!attrs) {
              attrs = {};
            }

            //make sure the mandatory fields are in (v1)
            var time = new Date().getTime();
            if (iot.getVersion() === "v1") {
                if (!attrs.manufacturer) {
                    attrs.manufacturer = 'node-manufacturer-indirect-' + time;
                }
                if (!attrs.productClass) {
                    attrs.productClass = 'node-productClass-indirect-' + time;
                }
                if (!attrs.serialNumber) {
                    attrs.serialNumber = 'node-serialNumber-indirect-' + time;
                }
            }

            //make sure the mandatory fields are in (v2)
            if (iot.getVersion() === "v2") {
                if (!attrs.hardwareId) {
                    attrs.hardwareId = "unique_hw_id_" + uuid.v4();
                }
                if (!attrs.deviceModels) {
                    attrs.deviceModels = [ iot.DEVICE_MODELS.GLOBAL_DM];
                }
            }

            var auth = gateway.getAuthorizationHeaders();
            return new Promise(function(resolve, reject) {
                iot.request({
                    uri: iot.INDIRECT_DEVICE_ACTIVAITON_URL,
                    method: "POST",
                    headers: auth,
                    json: true,
                    body: attrs
                }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        resolve(response);
                    } else {
                        reject(response || error);
                    }
                });
            });
      };
      if (gateway.getAuthorizationHeaders() && gateway.getTokenScope() === "") {
          return sendRequest(attributes);
      }
      return gateway.requestToken().then(function() {
          return sendRequest(attributes);
      });
    },

    requestActivationPolicy: function() {
        var gateway = this;
        var iot = this.iot;
        var req;
        if (iot.getVersion() === "v1") {
            var entity = {deviceAttributes: {OSName: "Mac OS X", OSVersion: "10.10.3"}};
            req = {
                uri: iot.POLICY_URL,
                method: "POST",
                headers: gateway.getAuthorizationHeaders(),
                json: true,
                body: entity
            };
        } else {
            //V2
            req = {
                uri: iot.POLICY_URL,
                method: "GET",
                headers: gateway.getAuthorizationHeaders(),
                json: true,
                qs: {
                    OSName: "Mac OS X",
                    OSVersion: "10.10.3"
                }
            };
        }
        return new Promise(function(resolve, reject) {
            iot.request(req, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    gateway._loadActivationPolicy(body);
                    resolve(gateway);
                } else {
                    reject(response || error);
                }
            });
        });
    },

    _activate: function(deviceModels) {
        var gateway = this;
        var iot = this.iot;
        var publicKey = gateway.getPublicKey();
        var clientID = gateway.getID();
        var policy = gateway.getActivationPolicy();

        var secretHashAlgo = "HmacSHA256";
        var hmac = crypto.createHmac("sha256", gateway.sharedSecret);
        if (iot.getVersion() === "v1") {
            hmac.update(clientID + "\n" + gateway.sharedSecret);
        } else {
            // V2, and likely later version, don't require the sharedSecret in payload
            hmac.update(clientID);
        }

        var secretHash = hmac.digest("base64");

        var header = clientID + "\n" + policy.keyType + "\n" + policy.format + "\n" + secretHashAlgo + "\n";
        var payload = Buffer.concat([new Buffer(header), new Buffer(secretHash, 'base64'), new Buffer(publicKey, 'base64')]);

        //note policy.hashAlgorithm is SHA256withRSA, same alg used in sign
        var signature = this.sign(payload);
        var activationPayload = {
            certificationRequestInfo: {
                subject: clientID,
                subjectPublicKeyInfo: {
                    algorithm : policy.keyType,
                    publicKey: publicKey,
                    format: policy.format,
                    secretHashAlgorithm: secretHashAlgo
                },
                attributes: null
            },
            signatureAlgorithm: policy.hashAlgorithm,
            signature: signature
        };
        if (deviceModels) {
            if (typeof deviceModels === "string") {
                activationPayload.deviceModels = [deviceModels];
            } else {
                activationPayload.deviceModels = deviceModels;
            }
        } else {
            activationPayload.deviceModels = [iot.DEVICE_MODELS.GLOBAL_DM];
        }
        //direct activation will not work without the capability, lets help here
        if (activationPayload.deviceModels.indexOf(iot.CAPABILITIES.direct_activation) === -1) {
            activationPayload.deviceModels.push(iot.CAPABILITIES.direct_activation);
        }

        return new Promise(function(resolve, reject) {
            iot.request({
                uri: iot.ACTIVATION_URL,
                method: "POST",
                headers: gateway.getAuthorizationHeaders(),
                json: true,
                body: activationPayload
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    gateway._loadActivation(body);
                    resolve(gateway);
                } else {
                    reject(response || error);
                }
            });
        });
    },

    activate: function(deviceModels) {
        var gateway = this;
        var policy = gateway.getActivationPolicy();
        if (policy) {
            return gateway._activate(deviceModels);
        }
        return gateway.requestActivationToken()
            .then(function() {
                return gateway.requestActivationPolicy();
            })
            .then(function() {
                return gateway._activate(deviceModels);
            });
    },

    /* Utilities methods - not part of standard device API */
    disable: function() {
        return this.iot.disableDevice(this);
    },

    delete: function() {
        return this.iot.deleteDevice(this);
    },

    getChildren: function(offset, limit) {
        var o = offset || 0;
        var l = limit || 200;
        var q = null;
        if (this.iot.getVersion() === "v1") {
            q = {
              type: "AND",
              children: [
                {
                  type: "EQUAL",
                  property: "state",
                  value: "ACTIVATED"
                },
                {
                  type: "EQUAL",
                  property: "directlyConnectedOwner",
                  value: this.getID()
                }
              ]
            };
            return this.iot.listEndpoints(q, o, l);
        } else {
            q = {
                directlyConnectedOwner: this.getID(),
                state: {$ne: "DECOMMISSIONED"}
            };
            return this.iot.listDevices(q, o, l);
        }
    }

};

module.exports = Device;

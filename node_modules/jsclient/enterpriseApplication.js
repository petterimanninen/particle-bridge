'use strict';
/* jshint sub: true */
var crypto = require('crypto');


var EnterpriseApplication = function(id, sharedSecret) {
    this.id = id;
    this.sharedSecret = sharedSecret;
    this.promise = null;
    this.token_type = null;
    this.access_token = null;

    this.hasCredentials = function() {
        return this.token_type && this.access_token;
    };

    this.clearCredentials = function() {
        this.token_type = null;
        this.access_token = null;
    };

    this.getCredentials = function(request, iot) {

        var ea = this;
        if (ea.promise) {
            return ea.promise.then(function(originalRequest) {
                if (!request.headers) {
                    request.headers = {};
                }
                request.headers['Authorization'] = originalRequest.headers['Authorization'];
                request.headers['X-EndpointId'] = originalRequest.headers['X-EndpointId'];
                return request;
            });
        }

        if (ea.token_type && ea.access_token) {
            if (!request.headers) {
                request.headers = {};
            }
            request.headers['Authorization'] = ea.token_type + ' ' + ea.access_token;
            request.headers['X-EndpointId'] = ea.id;
            return Promise.resolve(request);
        }

        var hmac = crypto.createHmac('sha256', this.sharedSecret);
        hmac.update(this.id + '\n' + this.sharedSecret);
        var hash = hmac.digest('base64');
        var formData = {
            grant_type: 'client_credentials',
            client_id: this.id,
            scope: '',
            client_secret: 'HmacSHA256:' + hash
        };

        ea.promise =  new Promise(function(resolve, reject) {
            iot.request({
                uri: iot.TOKEN_URL,
                method: 'POST',
                json: true,
                form: formData
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    resolve(body);
                } else {
                    reject(response);
                }
            });
        })
        .then(function(response) {
            ea.token_type = response.token_type;
            ea.access_token = response.access_token;
            ea.promise = null;

            if (!request.headers) {
                request.headers = {};
            }
            request.headers['Authorization'] = response.token_type + ' ' + response.access_token;
            request.headers['X-EndpointId'] = ea.id;
            return request;
        });
        return ea.promise;
    };
};


module.exports = EnterpriseApplication;

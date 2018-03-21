'use strict';
/* jshint sub: true */


var Application = function(body) {
    this._body = body;
    //consider subclassing EA for auth credentials
    //need to figure out what that means in v2

    this.getID = function() {
        return this._body.id;
    };

    this.getName = function() {
        return this._body.name;
    };

    this.getDescription = function() {
        return this._body.description;
    };
};

var querystring = require("querystring");
console.log(querystring.stringify({ foo: 'bar', baz: ['qux', 'quux'], corge: '' }));
console.log(typeof querystring.stringify({}));
console.log(querystring.stringify({}).length);

var a = {
    q: JSON.stringify({name: "Felp", surname: "e", config:[]}),
    limit: 0,
    offset: 4
};
console.log(querystring.stringify(a));


module.exports = Application;

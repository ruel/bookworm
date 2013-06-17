/*
 * bookworm.js
 */

// Needed for the client
var http = require('http');
var https = require('https');
var querystring = require('querystring');

// Generic options
function getOpts() {
    var opts = {
        hostname    :   'node.ruel.me',
        port        :   80,
        path        :   '/',
        method      :   'GET'
    };

    // Return the options
    return opts;
}

function get_delete(path, params, callback) {
    
    // Provide a method parameter
    get(path, params, callback, 'DELETE');
}

function get(path, params, callback, method) {

    // If somehow, method is defined
    method = typeof method !== 'undefined' ? method : 'GET';

    // Port for later on
    var port = method === 'DELETE' ? 443 : 80;

    // Options
    var gopts = getOpts();

    // We need to change this later
    var agent = http;

    gopts.port      =   port;
    gopts.path      =   path + '?' + querystring.stringify(params);
    gopts.method    =   method;

    // We need to set the right options for DELETE
    if (method === 'DELETE') {
        gopts['headers'] = { 'Content-Length' : 0 };
        gopts['rejectUnauthorized'] = false;
        agent = https;
    }

    // Request object
    var request = agent.request(gopts, function(response) {
        var books = "";

        // If ever data is chunked
        response.on('data', function(data) {
            books += data.toString();
        });

        // Last segment
        response.on('end', function() {
            callback(JSON.parse(books));
        });
    });

    // End the request
    request.end();
}

function post(path, get_params, post_params, callback) {

    // Stringify the parameters (post)
    var params = JSON.stringify(post_params);

    // Options
    var popts = getOpts();

    popts.port      =   443;
    popts.path      =   path + '?' + querystring.stringify(get_params);
    popts.method    =   'POST';

    // Since the cert is self signed, we need to disable
    // rejectUnauthorized
    popts['rejectUnauthorized'] = false;

    // Headers for POST
    popts['headers']    =   {
        'Content-Type'      :   'application/json',
        'Content-Length'    :   params.length
    };

    // Request object
    var request = https.request(popts, function(response) {
        var restring = "";

        // Catch the chunks
        response.on('data', function(data) {
            restring += data.toString();
        });

        // Last segment
        response.on('end', function() {
            callback(JSON.parse(restring));
        });
    });

    // Write the post data
    request.write(params);
    request.end();
}

// Export functions on our module
exports.get = get;
exports.post = post;
exports.delete = get_delete;

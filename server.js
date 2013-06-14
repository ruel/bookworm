/*
 * server.js
 */

// Needed packages/modules
var express = require('express');
var consolidate = require('consolidate');
var swig = require('swig');
var http = require('http');

// Our very own bookworm api wrapper module
// Sort of.
var bookworm = require(__dirname + '/bookworm.js');

// app callback for http
var app = express();

// Swig initialization
app.engine('.html', consolidate.swig);
app.set('view-engine', 'html');

// Real swig initialization
swig.init({
    root        :   __dirname + '/views',
    allowErrors :   true
});
app.set('views', __dirname + '/views');

// Index
app.get('/', function(request, response) {
    response.render('index.html');
});

// Book details
app.get('/book', function(request, response) {
    
    // Validate parameter
    if (request.query.id !== undefined && request.query.id !== '') {
        var id = request.query.id;

        // Get content
        bookworm.get('/books/' + id, {}, function(data) {
            
            // Check if the book is found
            if (data.status === 'OK')
                response.render('book.html', { book : data.data });
            else
                response.redirect('/notfound');
        });
    } else {

        // Redirect to a 404 page
        response.redirect('/notfound');
    }
});

// Book list
app.get('/books', function(request, response) {
    
    // Default options
    var params = {
        fields      :   'book_id,title,authors,tags,cover_image_url',
        limit       :   12,
        offset      :   0,
        sortby      :   'title',
        sortorder   :   'asc'
    };

    bookworm.get('/books', params, function(books) {
        response.render('books.html', { books : books });
    });
});

// User from facebook
app.get('/gettoken', function(request, response) {
    
    // Get the facebook access_token
    if (request.query.fb_token !== undefined &&
        request.query.fb_id !== undefined) {
        var fb_token = request.query.fb_token;
        var fb_id = request.query.fb_id;

        // Let's query the api for the token, and verify the user
        bookworm.post('/users/token', {}, { fb_token : fb_token, fb_id : fb_id }, function(data) {
            response.json(data);
        });
    } else {

        // Return a not OK status
        response.json({ status : "NOK" });
    }
});

// Static files
app.use('/js', express.static(__dirname + '/bootstrap/js'));
app.use('/img', express.static(__dirname + '/bootstrap/img'));
app.use('/css', express.static(__dirname + '/bootstrap/css'));
app.use('/less', express.static(__dirname + '/bootstrap/less'));
app.use('/scss', express.static(__dirname + '/bootstrap/scss'));
app.use('/font', express.static(__dirname + '/bootstrap/font'));

// Listen to a random port (proxied)
app.listen(1338);

// Lower priveleges
process.setgid('www-data');
process.setuid('www-data');

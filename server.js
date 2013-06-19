/*
 * server.js
 */

// Needed packages/modules
var express = require('express');
var consolidate = require('consolidate');
var swig = require('swig');
var http = require('http');
var https = require('https');
var crypto = require('crypto');

// Our very own bookworm api wrapper module
// Sort of.
var bookworm = require(__dirname + '/bookworm.js');

// Caching, this saves the CPU from swig
var page_cache = [];

// Views and downloads changes more often
// This can be tricky
var view_cache = [];
var down_cache = [];

// app callback for http
var app = express();

// We need this for POST
// Such a drag debugging, till I realized
// I forgot this line
app.use(express.bodyParser());
app.use(express.compress());

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
    response.sendfile(__dirname + '/views/index.html');
});

// Ajax call for view counts and downloads
app.get('/views', function(request, repsonse) {
    
    // Validate query
    if (request.query.id !== undefined) {
        var id = request.query.id;
        if (id in views_cache && id in down_cache) {
            response.json({ 
                status : 'OK', 
                view_count : view_cache[id], 
                down_count : down_cache[id]
            });
        } else {
            response.json({ status : 'NOK' });
        }
    } else {
        response.json({ status : 'NOK' });
    }
});

// Book details
app.get('/book', function(request, response) {
    
    // Validate parameter
    if (request.query.id !== undefined && request.query.id !== '') {
        var id = request.query.id;
        
        // Let's do the caching!
        var hash = doMd5(id);
        
        // Get content
        bookworm.get('/books/' + id, {}, function(data) {
             
            // Check if the book is found
            if (data.status === 'OK')
                
                // Then get reviews
                bookworm.get('/books/' + id + '/reviews', {}, function(result) {
                    
                    // Re-format the date string
                    for (var i in result.data.reviews) {
                        var fdate = new Date(result.data.reviews[i].date_created);
                        result.data.reviews[i]['date_created_formatted'] = fdate.toString('MMMM d, yyyy hh:mm a');
                    }
                    
                    // Check append the result to the data
                    data.data['reviews'] = result.data.reviews;
                    
                    // Separate the page count
                    // and downloads
                    view_cache[id] = data.data.view_count;
                    down_cache[id] = data.data.download_count;
                    delete data.data.download_count;
                    delete data.data.view_count;

                    // Compute for the checksum
                    var checksum = doMd5(JSON.stringify(data.data));
                    var found = false;

                    // Check for data change
                    for (var i in page_cache) {
                        if (page_cache[i].page === 'book' &&
                            page_cache[i].hash === hash &&
                            page_cache[i].checksum === checksum) {
                        
                            // Check for checksum
                            found = true;
                            response.end(page_cache[i].html);
                            break;
                        }
                    }

                    // Render page, and generate cache
                    if (!found) {
                        response.render('book.html', { 
                            book : data.data 
                        }, function(error, html) {

                            page_cache.push({
                                page : 'book',
                                checksum : checksum,
                                hash : hash,
                                html : html
                            });

                            response.end(html);
                        });
                    }
                });
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
        fields      :   'book_id,title,authors,tags,rating_average,cover_image_url',
        limit       :   12,
        offset      :   0,
        sortby      :   'title',
        sortorder   :   'asc'
    };
    
    var page = 1;
    var query = '';
    var is_search = false;

    // Searching
    if (request.query.keyword !== undefined &&
        request.query.searchby !== undefined &&
        (request.query.searchby === 'title' ||
        request.query.searchby === 'description')) {
        
        // Then let's do it
        params['searchby'] = request.query.searchby;
        params['keyword'] = request.query.keyword;

        query += 'keyword=' + params.keyword + '&';
        query += 'searchby=' + params.searchby + '&';

        is_search = true;
    }
    
    // For author searching
    if (request.query.author !== undefined) {
        
        // Add tag to parameters and query
        params['author'] = request.query.author;
        query += 'author=' + params.author + '&';

        is_search = true;
    }

    // For tag searching
    if (request.query.tag !== undefined) {
        
        // Add tag to parameters and query
        params['tag'] = request.query.tag;
        query += 'tag=' + params.tag + '&';

        is_search = true;
    }

    // Check for a page query
    if (request.query.page !== undefined) {
        
        // Parse to integer
        page = parseInt(request.query.page);
        
        // Make sure it's valid int
        if (!isNaN(page)) {
            params.offset = params.limit * (page - 1);
        }
    }

    // For the rating average
    if (params.rating_average === undefined) {
        params.rating_average = 0;
    }

    // Generate hash for books
    var hash = doMd5(JSON.stringify(params));

    bookworm.get('/books', params, function(books) {
        
        // We need to construct a range of 5 digits for paging
        books['page'] = page;
        books['range'] = [];

        // We'd like to insert a max_page to the JSON response
        var max_page = Math.ceil(books.count / params.limit);
        
        // Fail safe
        if (books.count === 0)
            max_page = 1;

        books['max_page'] = max_page;
        
        // Append the query
        books['query'] = query;
        books['is_search'] = is_search;
        
        // Conditions for page style formatting
        if (page < 3) {
            for (var i = 1; i <= max_page && i <= 5; i++) 
                books.range.push(i);
        } else if (max_page === 4) {
            for (var i = 1; i <= max_page; i++)
                books.range.push(i);
        } else if (page > (max_page - 3)) {
            for (var i = (max_page - 4); i <= max_page ; i++)
                books.range.push(i);
        } else {
            for (var i = (page - 2); i <= (page + 2); i++)
                books.range.push(i);
        }
        
        // Query the API for tag list
        bookworm.get('/tags', {}, function(tags) {
            
            // Add to books data
            books['tags'] = tags.data;

            // Then query for authors
            bookworm.get('/authors', {}, function(authors) {
            
                // Add to books data too
                books['authors'] = authors.data;
                
                // Compute the checksum
                var checksum = doMd5(JSON.stringify(books));
                var found = false;

                // Search for checksum and hash
                for (var i in page_cache) {
                    if (page_cache[i].page === 'books' &&
                        page_cache[i].hash === hash &&
                        page_cache[i].checksum === checksum) {
                    
                        // Return the cache
                        response.end(page_cache[i].html);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    
                    // Generate cache
                    response.render('books.html', { books : books }, function(error, html) {
                        page_cache.push({
                            page : 'books',
                            hash : hash,
                            checksum : checksum,
                            html : html
                        });

                        response.end(html);
                    });
                }
            });
        });
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

// Review deletion
app.post('/delreview', function(request, response) {
    
    // Verify the fields again
    if (request.body.access_token !== undefined &&
        request.body.uid !== undefined &&
        request.body.book_id !== undefined) {
        
        // query the api server again
        bookworm.delete('/books/' + request.body.book_id + '/reviews/' + request.body.uid, {
            access_token : request.body.access_token
        }, function (data) {

            // Return response
            response.json(data);
        });

    } else {
        
        // Invalid post data
        response.json({ status : 'NOK', message : 'Invalid data posted' });
    }
});

// Review posting
app.post('/postreview', function(request, response) {
    
    // Verify the fields
    if (request.body.access_token !== undefined &&
        request.body.book_id !== undefined &&
        request.body.rating !== undefined &&
        request.body.comment !== undefined) {
        
        // Let's then query the api server
        bookworm.post('/books/' + request.body.book_id + '/reviews', {
            access_token    :   request.body.access_token
        }, {
            rating  :   request.body.rating,
            comment :   request.body.comment
        }, function(data) {

            // Return the response
            response.json(data);
        });
    } else {
        
        // Return an error
        // This has nothing to do with the API, just how the
        // communication between the webserver and html via ajax
        response.json({ status : 'NOK', message : 'Invalid data posted' });
    }
});

// Admin
app.get('/admin', function(request, response) {
    response.sendfile(__dirname + '/views/admin.html');
});

// Static files
/*
 * You can use this,
 * or just use a webserver to serve static files (better)
app.use('/js', express.static(__dirname + '/bootstrap/js'));
app.use('/img', express.static(__dirname + '/bootstrap/img'));
app.use('/css', express.static(__dirname + '/bootstrap/css'));
app.use('/less', express.static(__dirname + '/bootstrap/less'));
app.use('/scss', express.static(__dirname + '/bootstrap/scss'));
app.use('/font', express.static(__dirname + '/bootstrap/font'));
 */

// Listen to a random port (proxied)
app.listen(1338);

// Lower priveleges
process.setgid('ruel');
process.setuid('ruel');

// md5 for hashing
function doMd5(password) {
    return crypto.createHash('md5').update(password).digest("hex");
}

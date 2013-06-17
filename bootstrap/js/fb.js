$(document).on('ready', function() {
    $.ajaxSetup({ cache: true });
    $.getScript('//connect.facebook.net/en_UK/all.js', function(){
        window.fbAsyncInit = function() {
            FB.init({
                appId: '342307982565212'
            });       
            $('#loginbutton,#feedbutton').removeAttr('disabled');
            FB.getLoginStatus(processFb);
        };
    });
    $(document).on('click', '#fblogin', function(e) {
        e.preventDefault();
        FB.login(processFb);
    });
});

function processFb(response) {
    if (response.authResponse) {
        if (response.status == 'connected') {
            FB.api('/me', function(me) {
                localStorage.setItem('uid', me.id);
                FB.api('/me/picture?type=square', function(pic) {
                    $('#fbrep').html('<img src="' + pic.data.url + '" class="fbthumb" /> ' + me.name);
                });
                var token = '';
                var tdata = localStorage.getItem('usertoken');
                if (tdata !== null) {

                    // Token is expired?
                    tdata = JSON.parse(tdata);
                    if (parseInt(tdata.access_token_exp) < Date.now()) {
                        // Get new
                        //console.log("Getting new token");
                        $.get('/gettoken', { 
                            fb_id : me.id,
                            fb_token : response.authResponse.accessToken
                        }, function(data) {
                            if (data.status === 'OK') {
                                token = data.data.access_token;
                                localStorage.setItem('usertoken', JSON.stringify(data.data));
                                userFunc();
                            } else {
                                token = '';
                            }
                        });
                    } else {
                        //console.log("Token still valid");
                        // Token is still valid
                        token = tdata.access_token;
                        userFunc();
                    }
                } else {
                    $.get('/gettoken', { 
                        fb_id : me.id,
                        fb_token : response.authResponse.accessToken
                    }, function(data) {
                        if (data.status === 'OK') {
                            token = data.data.access_token;
                            localStorage.setItem('usertoken', JSON.stringify(data.data));
                            userFunc();
                        } else {
                            token = '';
                            localStorage.setItem('usertoken', JSON.stringify({ access_token : '', access_token_exp : Date.now() }));
                        }
                    });
                }
                //console.log(token);
            });
        } else {
           $('#fbrep').html('<a href="#" id="fblogin" class="btn btn-small btn-primary">Login with Facebook</a></span>'); 
           clearUser();
        }
    } else {
        $('#fbrep').html('<a href="#" id="fblogin" class="btn btn-small btn-primary">Login with Facebook</a></span>'); 
        clearUser();
    }
}

function validateToken() {
    var tdata = localStorage.getItem('usertoken');
    if (tdata !== null) {
        tdata = JSON.parse(tdata);
        if (tdata.access_token.length > 0 &&
            tdata.access_token_exp > Date.now()) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}

function clearUser() {
    localStorage.removeItem('usertoken');
    localStorage.removeItem('uid');
}

function getToken() {
    if (validateToken()) {
        var tdata = JSON.parse(localStorage.getItem('usertoken'));
        return tdata.access_token;
    } else {
        return '';
    }
}

function userFunc() {
    $('#addform').slideDown(500);
    
    $('.close').each(function() {
        var uid = $(this).attr('id').substring(1);
        if (localStorage.getItem('uid') === uid) {
            $('.close').show(); 
        }
    });
}

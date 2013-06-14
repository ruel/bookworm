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
                FB.api('/me/picture?type=square', function(pic) {
                    $('#fbrep').html('<img src="' + pic.data.url + '" class="fbthumb" /> ' + me.name);
                });
                $.get('/gettoken', { 
                    fb_id : me.id,
                    fb_token : response.authResponse.accessToken
                }, function(data) {
                    console.log(data);
                });
            });
        } else {
           $('#fbrep').html('<a href="#" id="fblogin" class="btn btn-small btn-primary">Login with Facebook</a></span>'); 
        }
    } else {
        $('#fbrep').html('<a href="#" id="fblogin" class="btn btn-small btn-primary">Login with Facebook</a></span>'); 
    }
}

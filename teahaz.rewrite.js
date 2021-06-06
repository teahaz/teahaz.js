const axios = require("axios").default;


class Chatroom
{
    constructor(args)
    {
        // check required data
        assert(args.username, 'Username has not been set!');
        assert(args.password, 'Password has not been set!');
        assert(args.nickname, 'Nickname has not been set!');
        assert(args.server  , 'Server has not been set!'  );

        // server url
        assert(args.server.startswith('http'), "Server url must include schema name! (https://)");
        this.server       = args.server;

        // basic requirements for the class to function
        this.username     = args.username;
        this.password     = args.password;
        this.nickname     = args.nickname;
        this.chatroom     = args.chatroom;

        // basic info about the chatroom
        this.chat_name     = args.chat_name;

        // auth
        this.cookie       = args.cookie;

        // handling response.
        // ~ if raw_response is set then the entire response object from axios will be returned
        //   instead of just the data in it.
        this.raw_response = args.raw_response;
    }

    _encode(text) { return btoa(text); } // placeholder for encryption
    _decode(text) { return atob(text); } // placeholder for decryption

    _sleep(ms) // internal sleep function
    { // ~ js sleep is long and messy
        return new Promise( res =>
            {
                setTimeout(res, ms)
            });
    }

    _handle_response(response) // handles the `raw_response` variable
    {
        // If the 'raw_response' instance variable is false [default],
        // then only return the data of the server response instead of the
        // whole thing.
        //
        // If the response does not have a 'data' field then return entire response
        if (!this.raw_response && response.data != undefined)
            response = response.data

        return response
    }

    _runcallbacks(callback, arg) // run callbacks for function
    { // ~ this gets called enough that its kinda worth it now
        if (callback != undefined)
        {
            callback(arg)
        }
    }

    _updateArgs(args) // update instance variables if they have been set
    { // ~ this is a generic function to be called at the begininng of other functions
        // it updates instance variables, if they have been redefined at a function call

        this.server = ((args.server != undefined)? args.server : this.server );

        this.username = ((args.username != undefined)? args.username : this.username );
        this.nickname = ((args.nickname != undefined)? args.nickname : this.nickname );
        this.password = ((args.password != undefined)? args.password : this.password );
        this.chatroom = ((args.chatroom != undefined)? args.chatroom : this.chatroom );

        this.chat_name = ((args.chat_name != undefined)? args.chat_name : this.chat_name );

        this.cookie = ((args.cookie != undefined)? args.cookie : this.cookie );

        this.raw_response = ((args.raw_response != undefined)? args.raw_response : this.raw_response );
    }

    _extract_cookie(server_response) // extract and save a cookie from the server response
    { // ~ axios doesnt have python requests-style session objects
        let temp = [];

        // cookies are sent back from the server via the `set-cookie` header
        temp = server_response.headers['set-cookie'][0].split('; ')[0].split('=');

        // loop through the cookies and find the one for this chatroom
        for(let i=0; i<temp.length; i++)
        {
            if (temp[i] == this.chatroom)
            {
                // save cookie
                this.cookie = temp[i+1]
            }
        }
    }

    // --------------------------- main functions ----------------------------

    async create_chatroom(args) // create a new chatroom
    {
        // chatroom name needs to be set
        assert(args.name, "Error: 'chat_name' (name of the chatroom) has not been set!");
        let chatname = args.name;

        // generic callbacks
        let callback_error   = args.callback_error;
        let callback_success = args.callback_success;

        // Update any instance variables that
        //  might have been set in the args obj.
        this._updateArgs(args);

        return axios({
            method: 'post',
            url: `${this.server}/api/v0/chatroom`,
            data: {
                "username": this.username,
                "password": this.password,
                "nickname": this.nickname,
                "chatroom_name": this.name
            }
        })
    }

    async use_invite(args) // use an invite
    {
        // invite Id needed for joining the chatroom
        assert(args.inviteId, "Error: 'invite' argument has not been set!")
        let inviteId = args.invite;

        // generic callbacks
        let callback_error   = args.callback_error;
        let callback_success = args.callback_success;

        // Update any instance variables that
        //  might have been set in the args obj.
        this._updateArgs(args);

        // make request to the server
        return axios({
            method: 'post',
            url: `${this.server}/api/v0/invite/${this.chatroom}`,
            data: {
                username: this.username,
                nickname: this.nickname,
                password: this.password,
                inviteId: inviteId
            }
        })
        .then((response) =>
            { // Successfully joined the chatroom.
                console.log("Successfully joined the chatroom!");

                // save cookie
                this._extract_cookie(response);

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Joining to chatroom failed.
                console.error("Failed to join the chatroom!");

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            });
    }

    async login(args) // login
    {
        // generic callbacks
        let callback_error   = args.callback_error;
        let callback_success = args.callback_success;

        // Update any instance variables that
        //  might have been set in the args obj.
        this._updateArgs(args);

        // make request
        return axios({
            method: 'post',
            url: `${this.server}/api/v0/login/${this.chatroom}`,
            data: {
                username: this.username,
                password: this.password
            }
        })
        .then((response) =>
            { // successful login
                console.log("Successfully logged in!");

                // save cookie
                this._extract_cookie(response);

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // login unsuccessful
                console.log("Login failed!");

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            });
    }
}


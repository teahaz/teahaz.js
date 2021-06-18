const assert = require('assert');
const crypto = require('crypto');
const fernet = require('fernet');
const axios = require("axios").default;


class Chatroom
{
    constructor(args)
    {
        //// Stuff that has to be set for the object to function
        assert(args.server  , 'Server has not been set!'  );
        assert(args.server.startsWith('http'), "Server url must include schema name! (https://)");
        this.server       = args.server;



        //// Stuff that can optionally be set
        this.chatroomID   = args.chatroomID;
        this.username     = args.username;
        this.password     = args.password;
        this.userID       = args.userID




        //// Stuff that probably should not be set, but its still possible
        this.chat_name    = args.chat_name;
        this.channels     = args.channels;
        this.cookie       = args.cookie;




        ///// Other, has nothing to do with the server

        // allows user to configure a proxy to route all traffic through
        // schema:
        // {
        //      host: "localhost",
        //      port: 8080
        // }
        this.proxy = args.proxy;


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
        this.password = ((args.password != undefined)? args.password : this.password );
        this.chatroomID = ((args.chatroom != undefined)? args.chatroom : this.chatroomID );

        this.chat_name = ((args.chat_name != undefined)? args.chat_name : this.chat_name );

        this.cookie = ((args.cookie != undefined)? args.cookie : this.cookie );

        this.raw_response = ((args.raw_response != undefined)? args.raw_response : this.raw_response );
    }


    _extract_cookie(server_response) // extract and save a cookie from the server response
    { // ~ axios doesnt have python requests-style session objects
        let temp = [];

        // cookies are sent back from the server via the `set-cookie` header
        temp = server_response.headers['set-cookie']

        // make sure that there was actually a cookie set
        if (temp && temp != undefined)
            temp = temp[0].split('; ')[0].split('=');
        else
            return

        // loop through the cookies and find the one for this chatroom
        for(let i=0; i<temp.length; i++)
        {
            if (temp[i] == this.chatroomID)
            {
                // save cookie
                this.cookie = temp[i+1]
            }
        }
    }


    _export()
    {
        return {
            server: this.server,

            chatroomID: this.chatroomID,
            userID: this.userID,

            password: this.password,
            cookie: this.cookie
            }
    }




    // --------------------------- main functions ----------------------------




    async create_chatroom(args) // create a new chatroom
    {
        // make sure function doesnt crash if no arguments were passed
        args = ((args)? args : {})


        // chatroom name needs to be set
        assert((args.chat_name || this.chat_name ), "Error: 'chat_name' (name of the chatroom) has not been set!");
        let chatname = args.chat_name;

        assert((args.username || this.username ), "Error: 'username' variable has not been passed ot 'create_chatroom'!");
        assert((args.password || this.password ), "Error: 'password' variable has not been passed ot 'create_chatroom'!");

        // generic callbacks
        let callback_error   = args.callback_error;
        let callback_success = args.callback_success;

        // Update any instance variables that
        //  might have been set in the args obj.
        this._updateArgs(args);

        return axios({
            method: 'post',
            url: `${this.server}/api/v0/chatroom/`,
            data: {
                "username": this.username,
                "password": this.password,
                "chatroom_name": chatname
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // Successfully joined the chatroom.


                // save things that we need to save from this
                this.userID = response.data.userID
                this.chatroomID = response.data.chatroomID
                this.chat_name = response.data.chatroom_name
                this.channels = [response.data.channelID]


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

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            });
    }


    async login(args) // login
    {
        // Make sure function doesnt crash if no arguments were passed.
        args = ((args)? args : {})

        // Make sure we have the needed data either in args or as instance variables.
        assert((args.userID || this.userID ), "Error: 'userID' variable has not been passed ot 'login'!");
        assert((args.password || this.password ), "Error: 'password' variable has not been passed ot 'login'!");
        assert((args.chatroomID || this.chatroomID ), "Error: 'chatroomID' variable has not been passed ot 'login'!");


        // Set callbacks, if supplied.
        let callback_error   = args.callback_error;
        let callback_success = args.callback_success;


        // The user is allowed to set instance variables at any call,
        // this function updates them globally across the entire object.
        this._updateArgs(args);


        // make request
        return axios({
            method: 'post',
            url: `${this.server}/api/v0/login/${this.chatroomID}`,
            data: {
                userID: this.userID,
                password: this.password
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // successful login

                // // save cookie
                this._extract_cookie(response);
                //
                // // only give back data the user asked for
                response = this._handle_response(response);
                //
                // // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // login unsuccessful

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            });
    }


    async logout() // remove cookies
    {
        // if there is no cookie then you are logged out of the chatroom
        this.cookie = '';
    }


    async check_login(args) // queries the server to check if the client has valid cookies
    {
        // Make sure function doesnt crash if no arguments were passed.
        args = ((args)? args : {})

        // Make sure we have the needed data either in args or as instance variables.
        assert((args.userID || this.userID ), "Error: 'userID' variable has not been passed ot 'login'!");

        // Set callbacks, if supplied.
        let callback_error   = args.callback_error;
        let callback_success = args.callback_success;

        // The user is allowed to set instance variables at any call,
        // this function updates them globally across the entire object.
        this._updateArgs(args);


        // make request
        return axios({
            method: 'get',
            url: `${this.server}/api/v0/login/${this.chatroomID}`,
            headers: {
                userID: this.userID,
                Cookie: `${this.chatroomID}=${this.cookie}`
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // logged in
                // // only give back data the user asked for
                response = this._handle_response(response);
                //
                // // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // not logged in

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            });
    }
}






class Storage
{
    constructor(args)
    {
        this.password = args.password;
        assert(this.password != undefined, "No password has been supplied!")

        this.localpath = args.path
        this.url = args.server + `/storage/${args.username}`
        assert(this.localpath != undefined || this.url != undefined, "Localpath OR server has to be set!")


        // calculate accesspw
        this.accesspw = crypto.createHash('sha256').update(this.password).digest('hex');
        this.chatrooms =  [];
    }

    _encrypt(text, password)
    {
        // placeholder for encryption
        // return btoa(text + password);
        return text
    }

    _decrypt(text, password)
    {
        // placeholder for decryption
        return atob(text + password);
    }



    appendItem(chatroom)
    {
        let data = chatroom._export();
        this.chatrooms.push(data);
    }
    addlist(list)
    {
        // for i in list
        // appendItem(list)
    }




    async storeRemote()
    {
        let data = this._encrypt(JSON.stringify(this.chatrooms), this.password);
        return axios({
            method: 'post',
            url: this.url,
            data: {
                data: data,
                password: this.accesspw,
            }
        })
        .then((res) =>
            {
                return Promise.resolve(res.data);
            })
        .catch((err) =>
            {
                return Promise.reject(err);
            });
    }
    storeLocal(path)
    {
        // json = JSON.serialise(this.chatroms)
        // ejson = encrypt(this.chatrooms, this.password)
        // fs.writefile(ejson, path)
    }




    async importRemote()
    {
        let data = await axios({
            method: 'get',
            url: this.url,
            headers: {
                password: this.accesspw
            }
        });
        assert(data.status === 200, `Failed response from server while getting files: ${data.data}`);
        data = data.data;
        data = JSON.parse(atob(data));

        let chatrooms = [];
        for (let i = 0; i < data.length; i++)
        {
            chatrooms.push(new Chatroom(data[i]));
        }

        return Promise.resolve(chatrooms)
    }
    importLocal()
    {
        // ejson = fs.readfile(path)
        // json = decrypt(ejson)
        // list = JSON.serialise(json)
        // newslist = []
        // for i in list:
        //          newslist.push(_restore(list))
    }




    async gethashRemote()
    {
        return axios({
            method: 'get',
            url: this.url + "/hash/",
            headers: {
                password: this.accesspw
            }
        })
        .then((res) =>
            {
                return Promise.resolve(res.data)
            })
        .catch((err) =>
            {
                return Promise.resolve(err)
            })
    }
    gethashLocal()
    {
    }




    async deleteRemote()
    {
        return axios({
            method: 'delete',
            url: this.url,
            headers: {
                password: this.accesspw
            }
        })
        .then((res) =>
            {
                return Promise.resolve(res.data)
            })
        .catch((err) =>
            {
                return Promise.resolve(err)
            })
    }
    deleteLocal()
    {
    }
}






module.exports = {
    chatroom: Chatroom,
    storage: Storage
}



























    // async use_invite(args) // use an invite
    // {
    //     // invite Id needed for joining the chatroom
    //     assert(args.inviteId, "Error: 'invite' argument has not been set!")
    //     let inviteId = args.invite;
    //
    //     // generic callbacks
    //     let callback_error   = args.callback_error;
    //     let callback_success = args.callback_success;
    //
    //     // Update any instance variables that
    //     //  might have been set in the args obj.
    //     this._updateArgs(args);
    //
    //     // make request to the server
    //     return axios({
    //         method: 'post',
    //         url: `${this.server}/api/v0/invite/${this.chatroomID}`,
    //         data: {
    //             username: this.username,
    //             password: this.password,
    //             inviteId: inviteId
    //         }
    //     })
    //     .then((response) =>
    //         { // Successfully joined the chatroom.
    //
    //             // save cookie
    //             this._extract_cookie(response);
    //
    //             // only give back data the user asked for
    //             response = this._handle_response(response);
    //
    //             // run callbacks if specified, and return promise
    //             this._runcallbacks(callback_success, response);
    //             return Promise.resolve(response);
    //         })
    //     .catch((response) =>
    //         { // Joining to chatroom failed.
    //
    //             // only give back data the user asked for
    //             response = this._handle_response(response);
    //
    //             // run callbacks if specified, and return promise
    //             this._runcallbacks(callback_error, response);
    //             return Promise.reject(response);
    //         });
    // }

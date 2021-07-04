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
        this.cookie       = args.cookie;
        this.channels     = args.channels;



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


    // _encode(text) { return btoa(text); } // placeholder for encryption
    // _decode(text) { return atob(text); } // placeholder for decryption
    _encode(text) { return Buffer.from(text, 'binary').toString('base64'); } // placeholder for encryption
    _decode(text) { return Buffer.from(text, 'base64').toString('binary'); } // placeholder for decryption

    async _keep_up_to_date()
    {
        // called by the constructor, this should be a call that runs every few seconds
        // and makes sure that all data (ie: chatroom details, channels etc) are up to date
        //
        // there should be an optional callback for changes so a client can render the new information
    }

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


    // FIXME: can probably be deleted
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


    _add_channels(new_channels_array) // filters a list of chatrooms and adds all that are unique to the channels instance variable
    {
        // The newest information is always trusted to be the most up-to-date one so,
        //   when getting a list just append the ones that are in the instance variables,
        //   but not in the new list and replace the instance variable with the new list.

        new_channels_array = ((Array.isArray(new_channels_array))? new_channels_array : [new_channels_array]);

        // if there arent any channels then just add this as the first
        if (this.channels == undefined)
        {
            this.channels = new_channels_array;
            return;
        }


        // get all ids from the new channels
        let newids_list = [];
        for (const channel of new_channels_array)
        {
            newids_list.push(channel.channelID);
        }



        for (const channel of this.channels)
        {
            if (!newids_list.includes(channel.channelID))
            {
                new_channels_array.push(channel);
            }
        }

        this.channels = ((Array.isArray(new_channels_array))? new_channels_array : [new_channels_array]);
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




    async create_chatroom({chat_name, callback_success, callback_error}={}) // create a new chatroom
    {
        // chatroom name needs to be set
        assert((chat_name || this.chat_name ), "Error: 'chat_name' (name of the chatroom) has not been set!");

        return axios({
            method: 'post',
            url: `${this.server}/api/v0/chatroom/`,
            header: {
                "Content-Type": "application/json"
            },
            data: {
                "username": this.username,
                "password": this.password,
                "chatroom_name": chat_name
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // Successfully created the chatroom.


                // save things that we need to save from this
                this.userID = response.data.userID
                this.chatroomID = response.data.chatroomID
                this.chat_name = response.data.chatroom_name

                // save new channels
                this._add_channels(response.data.channels)


                // save cookie
                this._extract_cookie(response);

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Creating to chatroom failed.

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            });
    }

    async use_invite({inviteID, username, password, callback_success, callback_error}={})
    {
        assert(inviteID, "No value supplied for 'inviteID'");
        assert(this.chatroomID, "Instance variable 'chatroomID' has not been set");


        // some values may have been assigned at the creation of the object,
        //  rather than when use_invite was called
        username = ((username != undefined)? username : this.username)
        password = ((password != undefined)? password : this.password)
        assert(username, "No value supplied for 'username'");
        assert(password, "No value supplied for 'password'");

        return axios({
            method: 'post',
            url: `${this.server}/api/v0/invites/${this.chatroomID}`,
            headers: {
                "Content-Type": "application/json"
            },
            data: {
                inviteID: inviteID,
                username: username,
                password: password
            }
        })
        .then((response) =>
            { // Successfully joined the chatroom.


                // // save things that we need to save from this
                // this.userID = response.data.userID
                // this.chatroomID = response.data.chatroomID
                // this.chat_name = response.data.chatroom_name

                // // save new channels
                // this._add_channels(response.data.channels)


                // // save cookie
                // this._extract_cookie(response);

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


    async create_invite({uses, bestbefore, callback_success, callback_error}={})
    {
        assert((typeof(uses) == 'number'       || uses == undefined), "'uses' variable has to be of type `number`.");
        assert((typeof(bestbefore) == 'number' || bestbefore == undefined), "'bestbefore' variable has to be of type `number`.");


        let headers = {
                "Cookie": `${this.chatroomID}=${this.cookie}`,
                "Content-Type": "application/json",
                userID: this.userID
        };

        // need to add obptional arguments like this as headers do not accept 'undefined'
        if (uses != undefined)
            headers.uses = uses;
        if (bestbefore != undefined)
            headers.bestbefore = bestbefore;


        return axios({
            method: 'get',
            url: `${this.server}/api/v0/invites/${this.chatroomID}`,
            headers: headers,
            proxy: this.proxy
        })
        .then((response) =>
            { // Successfully sent message.

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Failed to send message.

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            })
    }

    async login({callback_success, callback_error}={}) // login
    {
        assert(this.userID ,   "Error: 'userID' variable has not been passed ot 'login'!");
        assert(this.password , "Error: 'password' variable has not been passed ot 'login'!");


        // make request
        return axios({
            method: 'post',
            url: `${this.server}/api/v0/login/${this.chatroomID}`,
            header: {
                "Content-Type": "application/json"
            },
            data: {
                userID: this.userID,
                password: this.password
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // successful login

                // save cookie
                this._extract_cookie(response);

                // save new channels
                this._add_channels(response.data.channels)

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
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


    logout() // remove cookies
    {
        // if there is no cookie then you are logged out of the chatroom
        this.cookie = '';
    }


    async check_login({callback_success, callback_error}={}) // queries the server to check if the client has valid cookies
    {
        assert(this.userID , "Error: 'userID' variable has not been passed ot 'login'!");


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
                // run callbacks if specified, and return promise
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


    async send_message({message, channelID, callback_success, callback_error}={}) // send message to chatroom
    {
        // check arguments
        assert((message && message.length > 0), "Cannot send empty message!");

        return axios({
            method: 'post',
            url: `${this.server}/api/v0/messages/${this.chatroomID}`,
            headers: {
                "Cookie": `${this.chatroomID}=${this.cookie}`,
                "Content-Type": "application/json"
            },
            data: {
                userID: this.userID,
                channelID: channelID,

                mtype: 'text',
                data: this._encode(message),

                keyID: null,
                replyID: null
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // Successfully sent message.

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Failed to send message.

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            })
    }


    async reply_message(args)
    {
    }


    async get_messages({count, start_time, channelID, callback_success, callback_error}={})
    {
        assert((typeof(count) == 'number'      || count == undefined),      "'count' variable has to be of type `number`.")
        assert((typeof(start_time) == 'number' || start_time == undefined), "'start_time' variable has to be of type `number`.")

        let headers = {
                "Cookie": `${this.chatroomID}=${this.cookie}`,
                "Content-Type": "application/json",
                userID: this.userID
        };

        // need to add obptional arguments like this as headers do not accept 'undefined'
        if (count != undefined)
            headers.count = count;
        if (start_time != undefined)
            headers.time = start_time;
        if (channelID != undefined)
            headers.channelID = channelID;

        return axios({
            method: 'get',
            url: `${this.server}/api/v0/messages/${this.chatroomID}`,
            headers: headers,
            proxy: this.proxy
        })
        .then((response) =>
            { // successfully got messages

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Failed to get messages.

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            })
    }


    async create_channel({channel_name, public_channel, callback_success, callback_error}={})
    {
        assert(channel_name, "channel_name must be specified!");

        // if not specified, public_channel will default to true
        public_channel = ((public_channel != undefined)? public_channel : true )

        return axios({
            method: 'post',
            url: `${this.server}/api/v0/channels/${this.chatroomID}`,
            headers: {
                "Cookie": `${this.chatroomID}=${this.cookie}`,
                "Content-Type": "application/json",
            },
            data: {
                userID: this.userID,
                channel_name: channel_name,
                public: public_channel
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // Successfully created channel.

                // only give back data the user asked for
                response = this._handle_response(response);

                // save any new channels
                this._add_channels(response)

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Failed to create channel

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            })
    }


    async get_channels({callback_success, callback_error}={}) // get channels that the user has access to
    {
        return axios({
            method: 'get',
            url: `${this.server}/api/v0/channels/${this.chatroomID}`,
            headers: {
                "Cookie": `${this.chatroomID}=${this.cookie}`,
                "Content-Type": "application/json",

                userID: this.userID
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // got everything successfully

                // only give back data the user asked for
                response = this._handle_response(response);

                // save any new channels
                this._add_channels(response)

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Failed

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            })
    }

    async get_users({callback_success, callback_error}={}) // get all users in a chatroom
    {
        return axios({
            get: 'get',
            url: `${this.server}/api/v0/users/${this.chatroomID}`,
            headers: {
                "Cookie": `${this.chatroomID}=${this.cookie}`,
                "Content-Type": "application/json",
                userID: this.userID
            },
            proxy: this.proxy
        })
        .then((response) =>
            { // got everything successfully

                // only give back data the user asked for
                response = this._handle_response(response);

                // FIXME: save all users locally as instance variables so we dont need a new call everytime we need user details.

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_success, response);
                return Promise.resolve(response);
            })
        .catch((response) =>
            { // Failed

                // only give back data the user asked for
                response = this._handle_response(response);

                // run callbacks if specified, and return promise
                this._runcallbacks(callback_error, response);
                return Promise.reject(response);
            })
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
                return Promise.reject(err)
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
                return Promise.reject(err)
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
    //     assert(args.inviteID, "Error: 'invite' argument has not been set!")
    //     let inviteID = args.invite;
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
    //             inviteID: inviteID
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

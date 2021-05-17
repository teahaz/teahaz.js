// if we are in node then we need to import this library for requests
if (typeof window == 'undefined') { axios = require("axios").default; }



class Chatroom
{
    constructor(args)
    {
        this.username     = args.username;
        this.password     = args.password;
        this.chatroom     = args.chatroom;
        this.server       = args.server;
        this.cookie       = args.cookie;
        this.raw_response = args.raw_response;
    }

    _encode(text) { return btoa(text); } // placeholder for encryption
    _decode(text) { return atob(text); } // placeholder for decryption

    _sleep(ms)
    {
        return new Promise( res => setTimeout(res, ms));
    }

    _runcallbacks(callback, arg)
    { // run callbacks for functions
        if (callback != undefined)
        {
            callback(arg)
        }
    }

    async login(args)// login to a chatroom
    { // callback_success, callback_error
        let callback_success = args.callback_success
        let callback_error = args.callback_error

        // make request
        return axios({
            method: 'post',
            url: `${this.server}/login/${this.chatroom}`,
            data: {
                username: this.username,
                password: this.password
            }
        })
        .then((response) =>
            { // successful login

                console.log("successfully logged in!");
                // we need to store the cookie ourselfs bc it makes workign with it easier

                // if the library is running in a browser then the browser steals the cookie header.
                // we need to combat this by getting it from document.cookie
                let temp = []
                if (typeof window == 'undefined')
                {
                    temp = response.headers['set-cookie'][0].split('; ')[0].split('=');
                }
                else
                {
                    temp = document.cookie.split('; ')[0].split('=')
                }

                // loop through the cookies and find the one for this chatroom
                for(let i=0; i<temp.length; i++)
                {
                    if (temp[i] == this.chatroom)
                    {
                        this.cookie = temp[i+1]
                    }
                }

                // if the user doesnt specify raw_response then just give the data back
                if (!this.raw_response) { response = response.data }

                // callback and promise for successful login
                this._runcallbacks(callback_success, response)
                return Promise.resolve(response)
            })
        .catch((response) =>
            { // failed login
                console.log("no suc");

                // if the user doesnt specify raw_response then just give the data back
                if (!this.raw_response) { response = response.data }

                // callback and promise for unsuccessful login
                this._runcallbacks(callback_error, response)
                return Promise.resolve(response)
            })
    }

    async send(args) // send a message to the chatroom
    { // message: str , callback_success, callback_error
        let message = args.message;
        let callback_success = args.callback_success;
        let callback_error = args.callback_error;


        // pls dont send empty messages
        if (message.length == 0 || message == undefined) { return Promise.reject("message must be at least 1 character") }

        // send request
        return axios({
            method: 'post',
            url: `${this.server}/api/v0/message/${this.chatroom}`,
            headers: {
                "Cookie": `${this.chatroom}=${this.cookie}`,
                "Content-Type": "application/json"
            },
            data: {
                username: this.username,
                type: 'text',
                message: this._encode(message)
            }
        })
        .then((response) =>
            {// message was sent successfully

                // if the user doesnt specify raw_response then just give the data back
                if (!this.raw_response) { response = response.data }

                //return messages or call callbacks
                this._runcallbacks(callback_success, response)
                return Promise.resolve(response)
            })
        .catch((response) =>
            {// message failed to send

                // if the user doesnt specify raw_response then just give the data back
                if (!this.raw_response) { response = response.data }

                //return messages or call callbacks
                this._runcallbacks(callback_error, response)
                return Promise.reject(response)
            });
    }

    async get_since_time(args) // get all messages since a given time
    { // time: str(int), callback_success, callback_error
        // time is user set or the last 10 minutes
        let time             = ((args.time != undefined)? String(args.time) : (new Date().getTime()/1000)-600);
        let callback_success = args.callback_success;
        let callback_error   = args.callback_error;

        // dont mess with time
        if (isNaN(time)) { return Promise.reject("Time is not a number. Please give time in epoch time format!") }


        return axios({
            method: 'get',
            url: `${this.server}/api/v0/message/${this.chatroom}`,
            headers: {
                "Cookie": `${this.chatroom}=${this.cookie}`,
                "username": this.username,
                "time": time
            }
        })
        .then((response) =>
            { // got messages successfully

                // if the user doesnt specify raw_response then just give the data back
                // this next bit decodes messages in data
                let newdata = [];
                if (!this.raw_response)
                {
                    let data = response.data;

                    for (let i=0; i<data.length; i++)
                    {
                        // need to decode message
                        let message = this._decode(data[i].message);

                        // system and system-silent return serialized json
                        if (['system', 'system-silent'].includes(data[i].type))
                        {
                            message = JSON.parse(message);
                        }

                        data[i].message = message;
                        newdata.push(data[i]);
                    }
                    response = newdata
                }

                //return messages or call callbacks
                this._runcallbacks(callback_success, response)
                return Promise.resolve(response)
            })
        .catch((response) =>
            { // failed to get messages

                // if the user doesnt specify raw_response then just give the data back
                if (!this.raw_response) { response = response.data }

                //return messages or call callbacks
                this._runcallbacks(callback_error, response)
                return Promise.reject(response)
            });
    }

    async monitor(args) // monitors a chatroom for new messages
    { // interval=1, callback_success, callback_error, return_messages=false, return_errors=false
        let interval          = ((args.interval != undefined)? args.interval : 1);
        let return_on_success = ((args.return_messages != undefined)? args.return_messages : false)
        let return_on_fail    = ((args.return_errors != undefined)? args.return_errors : false)
        let callback_success  = args.callback_success
        let callback_error    = args.callback_error

        if (typeof(interval) != 'number') { return Promise.reject("Interval time is not an intiger. Please specify interval as an integer in seconds!") }

        let seen = [];
        while (true)
        {
            let timestamp = new Date().getTime()/1000;

            // get all data since the last 2 intervals
            // this extra data is for redundancy as we might miss something if it happens at the same time as our request
            let fail = false
            let response = await this.get_since_time((timestamp-(interval*5)))
            .catch ((response) =>
                {
                    this._runcallbacks(callback_error, response)
                    fail = true
                })

            // check if getting message failed
            if (fail)
            {
                // if user said to return on fail then do so
                if  (return_on_fail)
                {
                    return Promise.reject(response)
                }

                // if not return then just continue to the next loop
                console.log("getting messages failed");
                continue
            }

            // need 2 variables so we can return keep the whole header for raw_response
            let data = response;

            // if raw_response is set then get_since_time returns the entire request
            // we need to filter that to use it
            if (this.raw_response) { data = data.data }

            // keep least rounds messages so we dont repring duplicates
            let seen_lastround = seen
            seen = []

            // go through available data and make sure that its not a duplicate
            for (let i=0; i<data.length; i++)
            {
                if (!seen_lastround.includes(data[i].messageId))
                { // got a new message

                    // run callbacks if there are any
                    this._runcallbacks(callback_success, response)

                    // return promise if return_on_success is set
                    if (return_on_success) { return Promise.resolve(response) }
                }
                seen.push(data[i].messageId);
            }

            // sleep interval
            await this._sleep(interval*1000);

        }
    }
}







/// testing stuff dont look at this :)
// these all have default values and you dont need to be this verbose, but well testing

//const test = async() =>
//{
//    conv1 = new Chatroom({
//        username: 'a',
//        password: '1234567890',
//        chatroom: '8c6789de-b551-11eb-a0cc-024298d109d7',
//        server:   'http://localhost:13337',
//        cookie: undefined,
//        raw_response: false
//    });
//
//    await conv1.login({
//        callback_success: undefined,
//        callback_error: console.log
//    });
//
//    await conv1.send({
//        message: "Good afternoon!",
//        callback_success: undefined,
//        callback_error: console.log
//    });
//
//    await conv1.get_since_time({
//        time: 0,
//        callback_success: console.log,
//        callback_error: console.log
//    });
//
//    conv1.monitor({
//        interval: 2,
//        callback_success: console.log,
//        callback_error: undefined,
//        return_messages: false,
//        return_errors: true
//    })
//    .catch((response) =>
//        {
//            console.error(response);
//        })
//}
//
//
//
//// conv1.send("hello")
//test()

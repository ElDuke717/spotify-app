require('dotenv').config();
const express = require('express');
//querystring is used to add the required params to the authorization url

const queryString = require('query-string');
const app = express();
const axios = require('axios');
const path = require('path');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const FRONTEND_URI = process.env.FRONTEND_URI;
const PORT = process.env.PORT || 8888;

// Priority serve any static files.
app.use(express.static(path.resolve(__dirname, './client/build')));

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};


const stateKey = 'spotify_auth_state';

app.get('/login', (req, res) => {
    // call generateRandomString to generate a random string 16 characters in length.
    const state = generateRandomString(16);
    // sets a cookie - with spotify_auth_state as the key and the random string as the value.
    res.cookie(stateKey, state);
    // Allows to access the details about the account user is logged in as.
    const scope = [
        'user-read-private',
        'user-read-email',
        'user-top-read',
    ].join(' ');

    const queryParams = queryString.stringify({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        state: state,
        scope: scope,
    });
    // querystring.stringify will return a string with the query params, we then use it to create the URL instead of adding them separately.
    res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

// axios call to get the access token.
app.get('/callback', (req, res) => {
    const code = req.query.code || null;

    axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: queryString.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
        }),
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
    })
        .then(response => {
            if (response.status === 200) {

                const { access_token, refresh_token } = response.data;

                const queryParams = queryString.stringify({
                    access_token,
                    refresh_token,
                });

                // redirect to react app
                res.redirect(`${FRONTEND_URI}/?${queryParams}`);
                // pass along tokens and query params

            } else {
                res.redirect(`/?${queryString.stringify({
                    error:
                        'invalid_token'
                })}`);
            }
        })
        .catch(error => {
            res.send(error);
        });
});

app.get('/refresh_token', (req, res) => {
    const { refresh_token } = req.query;

    axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: queryString.stringify({
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        }),
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
    })
        .then(response => {
            res.send(response.data);
        })
        .catch(error => {
            res.send(error);
        });
})

// All remaining requests return the React app, so it can handle routing.
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, './client/build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Express app listening at http://localhost:${PORT}`);
});
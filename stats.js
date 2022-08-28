const fs = require('fs');
const readline = require('readline');
const {
  google
} = require('googleapis');
const axios = require('axios');
const querystring = require('querystring');

require('dotenv').config()

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

const SHEET_ID =process.env.SHEET_ID;

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), listPlayers);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function listPlayers(auth) {
  const aoe2api = axios.create({
    baseURL: 'https://aoe2.net/api/'
  });
  const sheets = google.sheets({
    version: 'v4',
    auth
  });
  sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Players',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const rows = res.data.values;
    if (rows.length) {
      // Print columns A and B, which correspond to indices 0 and 1.
      var i = 0;
      const myMap = new Map();
      rows.sort((a, b)=> b[4] - a[4]);
      rows.forEach((row) => {
        console.log(`${row[1]}, ${row[2]}`);
        if (i === 0) {
          i++;
          return;
        } else {
          i++;
          var name = row[2];
          var steamId = row[1];
          myMap.set(steamId,i);

          if (steamId) {
            axios({
              method: 'GET',
              url: 'https://aoe2.net/api/leaderboard?' + querystring.stringify({
                game: 'aoe2de',
                leaderboard_id: '0',
                start: '1',
                count: '1',
                steam_id: steamId

              }),
            }).then(function(response) {
              var leaderboard = response.data.leaderboard[0];

              var index = parseInt(myMap.get(leaderboard.steam_id));
              var range = 'Players!A' + index+ ':H' + index


              sheets.spreadsheets.values.update({
                includeValuesInResponse: false,
                range: range,
                spreadsheetId: SHEET_ID,
                valueInputOption: 'USER_ENTERED',

                requestBody: {
                  majorDimension: 'ROWS',
                  range: range,
                  values: [
                    [index-1, leaderboard.steam_id, leaderboard.name, leaderboard.rank, leaderboard.rating, leaderboard.games, leaderboard.streak, leaderboard.wins],
                  ]
                },
              }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
              });
              sheets.spreadsheets.values.update({
                // Determines if the update response should include the values of the cells that were updated. By default, responses do not include the updated values. If the range to write was larger than the range actually written, the response includes all values in the requested range (excluding trailing empty rows and columns).
                includeValuesInResponse: false,
                // The A1 notation of the values to update.
                range: 'Technical!A1:B1',
                // The ID of the spreadsheet to update.
                spreadsheetId: SHEET_ID,
                // How the input data should be interpreted.
                valueInputOption: 'USER_ENTERED',

                // Request body metadata
                requestBody: {
                  // request body parameters
                  // {
                  majorDimension: 'ROWS',
                  range: 'Technical!A1:B1',
                  values: [
                    ["Date Last Update" , new Date().toLocaleString()],
                  ]
                  // }
                },
              }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
              });

            }).catch(function(error) {
              console.log(error);
            });
          }
        }
      });
      console.log('My Map', myMap);
    } else {
      console.log('No data found.');
    }
  });
}

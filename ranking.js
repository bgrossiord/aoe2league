const fs = require('fs');
const glicko2 = require('glicko2');
const axios = require('axios');
const querystring = require('querystring');

var settings = {
  // tau : "Reasonable choices are between 0.3 and 1.2, though the system should
  //       be tested to decide which value results in greatest predictive accuracy."
  tau : 0.6,
  // rating : default rating
  rating : 1000,
  //rd : Default rating deviation
  //     small number = good confidence on the rating accuracy
  rd : 300,
  //vol : Default volatility (expected fluctation on the player rating)
  vol : 0.06
};
var ranking = new glicko2.Glicko2(settings);

const players = require("./players.json")

const league_players = players.map(player => player.steam_id);

const mapPlayersRanking = new Map();

var treatedMatches = [] ;


players.forEach( (player) => {
  mapPlayersRanking.set(player.steam_id, ranking.makePlayer(player.rating, player.deviation, player.volatility));
});

var allMatches =[];
var existing_ids =[];

const isALeaguePlayer = player_id => {
  var res = league_players.includes(player_id);
  return res;
}

// Load json matches from a local file.
players.forEach( player => {
 try{
   var content =  fs.readFileSync(process.cwd()+'\\matches\\matches_'+player.name+'.json')
   console.log(JSON.parse(content).length+ " matches to treat from " +player.name);
   existing_ids = allMatches.map(match => match.match_id);
   var toAddMatches = JSON.parse(content).filter(match =>!existing_ids.includes(match.match_id) && isALeague(match))
    console.log(toAddMatches.length+ " matches not treated and league players involved from" +player.name);
   allMatches = allMatches.concat(toAddMatches);
 } catch (err){
   return console.log('Error loading matches file:', err);
 }
});

treatJsonMatches(allMatches);

function treatJsonMatches(matches) {

  console.log("Total match to treat",matches.length);
  const leagueMatches = matches.sort((match1, match2)=> match2.opened - match1.opened);
  leagueMatches.reverse().forEach(treatMatch);

  players.forEach( player => {
    var ranking = mapPlayersRanking.get(player.steam_id);
    console.log( "steam_id : "+player.steam_id +", "+ player.name +" , rating: "+ranking.getRating()  +" , deviation: " +ranking.getRd() +" , volatility: "+ ranking.getVol());
  })

  console.log( "last match treated finised on " +leagueMatches.reduce((matcha,matchb) => matcha.finished>matchb.finished ? matcha:matchb).finished);

}

function treatMatch( match ){

  var winingTeam = match.players.filter(player => player.won === true);

  var meanWiner  = getMeanPlayer(winingTeam);

  var losingTeam = match.players.filter(player => player.won==false);
  var meanLoser  = getMeanPlayer(losingTeam);
  var matches = [];

  winingTeam.forEach( winner => matches.push([ mapPlayersRanking.get(winner.steam_id), meanLoser, 1]))
  losingTeam.forEach(loser => matches.push([meanWiner, mapPlayersRanking.get(loser.steam_id), 1]))
  ranking.updateRatings(matches);

  treatedMatches.push(match.match_id);
}

function getMeanPlayer(team){
  var teamMeanRating = team.reduce((sum , player) => sum + mapPlayersRanking.get(player.steam_id).getRating(), 0)/team.length;
  var teamMeanDeviation = team.reduce((sum , player) => sum + mapPlayersRanking.get(player.steam_id).getRd(), 0)/team.length;
  var teamMeanVol = team.reduce((sum , player) => sum + mapPlayersRanking.get(player.steam_id).getVol(), 0)/team.length;
  var meanWinner = ranking.makePlayer(teamMeanRating, teamMeanDeviation, teamMeanVol);
  return meanWinner;
}


function isALeague(match){

  var res= match.players.map(player=> player.steam_id).every(isALeaguePlayer);
  return res;
}

module.exports = {rank};
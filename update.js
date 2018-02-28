var fs = require('fs'),
    request = require('request'),
    cron = require('node-cron');

if (!fs.existsSync('lastTime.txt')) {
   var now = Math.round(Date.now() / 1000)
   fs.writeFileSync('lastTime.txt', now - (24*60*60)); // one day back
}

var lastTime = parseInt(fs.readFileSync('lastTime.txt', {"encoding":"utf8"}), 10);
var currentTime = Math.round(Date.now() / 1000);
var slackURL = "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXX"
var slackAuthorizationToken = "XXXXXXXXXXXXXXXXXXXXXXX"

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

function getJSON(target, success, error) {
   request({"uri":target,"gzip": true}, function (err, response, body) {
      if (!err && response.statusCode == 200) {
         success(JSON.parse(body), response, body);
      }
      else {
         console.log("get failed: " + target);
         error(err, response, body);
      }
   });
}

var QuestionURL = "https://api.stackexchange.com/2.2/questions?order=desc&sort=activity&tagged=rx-swift&site=stackoverflow";

//run every 10 minutes
cron.schedule('*/10 * * * *', function(){
   console.log("cron running")

   lastTime = parseInt(fs.readFileSync('lastTime.txt', {"encoding":"utf8"}), 10);
   currentTime = Math.round(Date.now() / 1000);

   getJSON(QuestionURL, 
      function(questions) {
         var currentResult = {};

         if (!lastTime) {
            lastTime = 0
         }

         questions.items.forEach(function(q) {
            if (q.last_activity_date > lastTime) {
               currentResult[q.question_id] = { "title": q.title, "activity": q.last_activity_date, "link": q.link, "actions": [] };
            }
         });

         if (Object.keys(currentResult).length === 0) { 
            console.log("No new questions")
            return;
         } else {
            console.log("New questions found")
         }

         sendToSlack(currentResult);
      },
      handleError
   );
});

function handleError(err, response, body) {
   console.error("Error getting with request: " + err);
   console.error(err);
   console.error(response);
   console.error(body);
}

function sendToSlack(res) {
   var keys = Object.keys(res);
   if (keys.length) {
      payload = {
         "text" : "New Questions on <http://stackoverflow.com/questions/tagged/rx-swift|RxSwift>:\n\n",
         "token" : slackAuthorizationToken
      };
      keys.forEach(function(rk) {
         var r = res[rk];
         payload.text += "<{0}|{1}>:\n".format(r.link, r.title);
         r.actions.sort(function (a,b) { return a.when - b.when; });
         payload.text += "\n";
      });

      request.post({"url":slackURL, form: {"payload":JSON.stringify(payload)}}, function (error, response, body) {

         if (!error && response.statusCode == 200) {
            fs.writeFileSync('lastTime.txt', currentTime);
         }
         else {
            console.error("Error sending message to Slack");
            console.error(error);
            console.error(response);
            console.error(body);
         }
      });
   }
}


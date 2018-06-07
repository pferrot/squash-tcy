// Number of days before the date of the training that the reminder is sent.
// This does not take hours into account, i.e. if the training is on Wednesday (any time) and we want the
// reminuder to be sent on Monday at 2am, then the method should be called at 2am. If called earlier,
// then it will still be sent. However, it will not be send if called on Sunday at 10pm for example as
// Sunday is 3 days before Wednesday.
var mReminderNextTrainingInMinDays = 2;
// Number of days before the date of the training that the confirmation is sent.
// Same logic as for mReminderNextTrainingInMinDays.
var mConfirmationNextTrainingInMinDays = 2;

// URL to the spreadsheet, used in reminder/confirmation emails sent to players.
var mLinkToSpreadsheet = "https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit?usp=sharing"

// This is the name that appears in the 'title' attribute of the <div> in the HTML source for a given
// day on tcy.ch.
// E.g. <div class="club cases"  style="cursor:pointer;text-decoration:underline;" onClick="window.location='annulation.php?d=ZmD1AQp1'; return false;" title="ENTRAÎNEMENT SQUASH">
var mTcyUser = "XXXXXXXXXXXXXXXXXXXX";
// The password to cancel the reservation.
var mTcyPassword = "XXXXXXXXXXXXXXXXXXXX";

// Always receive a copy of confirmation emails and receive notifications in case
// of processing errors with the cancelCourtsAndSendConfirmationToParticipants() function.
var mAdmins = ["XXXXXXXXXXXXXXXXXXXX@XXXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXX"];
//var mAdmins = ["patrice.ferrot@protonmail.com"];

// Orders in which courts should be cancelled.
var mCourtsCancelOrder = [1, 2, 4, 3];

/*
Archive trainings that took place on a day in the past (does not take hours into account, just the date).
*/
function archivePastTrainings() {
  var st = new SquashTraining(mReminderNextTrainingInMinDays, mConfirmationNextTrainingInMinDays, mLinkToSpreadsheet);
  st.archivePastTrainings();
}

/*
Sends a reminder to all players with an email address who have not responded yet if the training is in the next
mReminderNextTrainingInMinDays days (not taking hours into account) and the reminder has not been seen yet (see
corresponding column in the spreadsheet).
*/
function sendReminderToParticipants() {
  var st = new SquashTraining(mReminderNextTrainingInMinDays, mConfirmationNextTrainingInMinDays, mLinkToSpreadsheet);
  st.sendReminderToParticipants();
}

/*
Cancels reservations depending on the number of players who will be present and also sends confirmation email to
participants if the training is in the next mConfirmationNextTrainingInMinDays days (not taking hours into account)
and the confirmation has not been seen yet (see corresponding column in the spreadsheet).
*/
function cancelCourtsAndSendConfirmationToParticipants() {
  console.info("Starting cancelCourtsAndSendConfirmationToParticipants");

  var st = new SquashTraining(mReminderNextTrainingInMinDays, mConfirmationNextTrainingInMinDays, mLinkToSpreadsheet);

  var participantsNextTraining = st.getParticipantsForNextTraining();
  if (participantsNextTraining) {
    if (participantsNextTraining.length == 2) {
      var trainingRow = participantsNextTraining[0].row;
      if (!st.isConfirmationAlreadySent(trainingRow)) {
        var tcy = new TCY();
        var courts = [];
        var date = undefined;
        for (var i = 0; i < participantsNextTraining.length; i++) {
          var time = participantsNextTraining[i].time;
          date = participantsNextTraining[i].date;
          var nbParticipants = 0;
          if (participantsNextTraining[i].participants) {
            nbParticipants = participantsNextTraining[i].participants.length;
          }
          var nbCourtsNeeded = 2;
          if (nbParticipants <= 1)
            nbCourtsNeeded = 0;
          else if (nbParticipants <= 3)
            nbCourtsNeeded = 1;

          var codes = tcy.findCancellationCodes(tcy.getDateHtmlSource(tcy.getCodeForDate(date)), mTcyUser);
          if (!codes) {
            console.error("TCY codes not found for: " + date);
            st.sendEmail(mAdmins.join(","), undefined, undefined, "TCY codes not found", "Date: " + date);
            return;
          }
          console.log("Found codes: " + codes);
          var codesForTime = [];
          var courtsNumbers = [];
          for (var j = 0; j < codes.length; j++) {
            var theTimeAndCourt = tcy.getCancellationTimeAndCourt(tcy.getCancellationPageHtmlSource(codes[j]));
            if (theTimeAndCourt) {
              console.log("Time and court for " + codes[j] + ": " + JSON.stringify(theTimeAndCourt));
              // Make sure we do not cancel for another time.
              if (time.indexOf(theTimeAndCourt.time) == 0) {
                console.log("Matches for " + time);
                codesForTime.push(codes[j]);
                courtsNumbers.push(theTimeAndCourt.court);
              }
              else {
                console.log("Does not match for " + time);
              }
            }
            else {
              console.error("Time and court not found for: " + codes[j]);
              st.sendEmail(mAdmins.join(","), undefined, undefined, "Time and court not found", "Code: " + codes[j]);
              return;
            }
          }
          console.log("Found codes for time: " + codesForTime);
          if (codesForTime.length > nbCourtsNeeded) {
            // Courts are cancelled in the order specified in mCourtsCancelOrder.
            var courtsToCancel = mCourtsCancelOrder.slice();
            for (var j = 0; j < codesForTime.length - nbCourtsNeeded; j++) {
              var indexToCancel = -1;
              var courtToCancelIndex = -1;
              // Find the court that listed first in the courtsToCancel array.
              for (var k = 0; k < courtsToCancel.length; k++) {
                indexToCancel = courtsNumbers.indexOf(courtsToCancel[k]);
                if (indexToCancel >= 0) {
                  console.log("Found index to cancel: " + indexToCancel + ", i.e. court no " + courtsNumbers[indexToCancel]);
                  courtToCancelIndex = k;
                  break;
                }
                else {
                  console.log("Preferred court to cancel not found: " + courtsToCancel[k]);
                }
              }
              if (indexToCancel < 0) {
                console.error("Index to cancel not found for: " + JSON.stringify(courtsNumbers));
                st.sendEmail(mAdmins.join(","), undefined, undefined, "Index to cancel not found", "Index to cancel not found for: " + JSON.stringify(courtsNumbers));
                return;
              }
              // Remove the one we found for the next iteration as it will have been canceled already.
              courtsToCancel.splice(courtToCancelIndex, 1);
              console.log("Courts to cancel for next iteration: " + JSON.stringify(courtsToCancel));

              var courtToCancel = courtsNumbers[indexToCancel];
              var codeToCancel = codesForTime[indexToCancel];
              console.log("Cancelling court no " + courtToCancel + ": " + codeToCancel);
              tcy.cancelReservation(codeToCancel, mTcyPassword);
            }
          }
          // Check again the reservation page to make sure the number of courts is ok.
          var codes = tcy.findCancellationCodes(tcy.getDateHtmlSource(tcy.getCodeForDate(date)), mTcyUser);
          if (!codes) {
            console.error("TCY codes not found on second check for: " + date);
            st.sendEmail(mAdmins.join(","), undefined, undefined, "TCY codes not found on second check", "Date: " + date);
            return;
          }
          else {
            // Reset and check again.
            codesForTime = [];
            courtsNumbers = [];
            for (var j = 0; j < codes.length; j++) {
              var theTimeAndCourt = tcy.getCancellationTimeAndCourt(tcy.getCancellationPageHtmlSource(codes[j]));
              if (theTimeAndCourt) {
                // Make sure we do not cancel for another time.
                if (time.indexOf(theTimeAndCourt.time) == 0) {
                  codesForTime.push(codes[j]);
                  courtsNumbers.push(theTimeAndCourt.court);
                }
              }
              else {
                console.error("Time and court not found for: " + codes[j]);
                st.sendEmail(mAdmins.join(","), undefined, undefined, "Time and court not found", "Code: " + codes[j]);
                return;
              }
            }
            if (codesForTime.length != nbCourtsNeeded) {
              console.error("Not the correct number of reservations when checking " + date + " " + time + ": expected " + nbCourtsNeeded + " but found " + codesForTime.length);
              st.sendEmail(mAdmins.join(","), undefined, undefined, "Not the correct number of reservations when checking " + date + " " + time, "Expected " + nbCourtsNeeded + " but found " + codesForTime.length);
              return;
            }
            else {
              courts.push({"time": time, "courts": courtsNumbers});
            }
          }
        }

        st.sendConfirmationToParticipants(date,
                                          tcy.getReservationLink(date),
                                          courts,
                                          participantsNextTraining,
                                          mAdmins);
        st.setConfirmationSent(trainingRow);
        // Logging is done in sendConfirmationToParticipants(...)
      }
      else {
        console.info("Confirmation already sent for training row " + trainingRow);
      }
    }
    else {
      console.error("Problem retrieving participants for confirmation email: " + JSON.stringify(participantsNextTraining));
      st.sendEmail(mAdmins.join(","), undefined, undefined, "Problem retrieving participants for confirmation email", JSON.stringify(participantsNextTraining));
    }
  }
  else{
    console.info("Not time to send confirmation yet.");
  }
}

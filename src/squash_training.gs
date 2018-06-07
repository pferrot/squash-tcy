/*
Utils to manipulate the training sheet, send email reminders,...
*/

var SquashTraining = function(pReminderNextTrainingInMinDays, pConfirmationNextTrainingInMinDays, pLinkToSpreadsheet) {

  this.mReminderSentColumn = 4;
  this.mReminderSentYes = "Oui";
  this.mConfirmationSentColumn = 5;
  this.mConfirmationSentYes = "Oui";
  this.mParticipateTrainingValuePositive = "Présent";
  this.mParticipantsStartRow = 2;
  this.mParticipantsStartColumn = 7;
  this.mTrainingStartRow = 4;
  this.mTrainingStartColumn = 2;
  this.mReminderNextTrainingInMinDays = pReminderNextTrainingInMinDays;
  this.mConfirmationNextTrainingInMinDays = pConfirmationNextTrainingInMinDays;
  this.mLinkToSpreadsheet = pLinkToSpreadsheet;
  this.mSheetNameFutureTrainings = "à venir";
  this.mSheetNamePastTrainings = "passés";
  // Should be more than enough. Ideally, we would detect how many columns need to be copied over dynamically,
  // but I am lazy right now.
  this.mNbColumnToArchive = 100;

  /*
  Archive rows for training that took place yesterday or before (i.e. moves
  them to another sheet).
  .
  */
  this.archivePastTrainings = function() {
    console.info("Starting archivePastTrainings");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var sheetArchive = ss.getSheetByName(this.mSheetNamePastTrainings);
    var pastTrainings = this.getPassedTrainingsRows();
    // Important to iterate backward as the rows are sorted ascending.
    // This will avoid deleting the wrong trainings...
    for (var i = pastTrainings.length - 1; i >= 0; i--) {
      sheetArchive.insertRowBefore(2);
      sheetArchive.insertRowBefore(2);
      var sourceRange = sheet.getRange(pastTrainings[i], 1, 2, this.mNbColumnToArchive);
      var targetRange = sheetArchive.getRange(2, 1, 2, this.mNbColumnToArchive);
      sourceRange.copyTo(targetRange);
      sheet.deleteRows(pastTrainings[i], 2);
    }
    console.info("Nb trainings archived: " + pastTrainings.length);
  }

  /*
  Returns a list of rows with training that are in the past.
  */
  this.getPassedTrainingsRows = function() {
    var result = this.getPassedTrainingsWithStartingCell(this.mTrainingStartRow, this.mTrainingStartColumn, 0, []);
    console.log("Passed trainings: " + JSON.stringify(result));

    return result;
  }

  this.getPassedTrainingsWithStartingCell = function(pRow, pColumn, pNbRowsNoDate, pTmpResult) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var range = sheet.getRange(pRow, pColumn, 1, 1);
    var values = range.getValues();
    var dateStr = values[0][0];
    console.log("Date str: " + dateStr);
    if (dateStr) {
      var dayMonthYear = dateStr.split(".");
      var day = parseInt(dayMonthYear[0], 10);
      var month = parseInt(dayMonthYear[1], 10);
      var year = parseInt(dayMonthYear[2], 10);
      console.log("Year: " + year + " (" + dayMonthYear[2] + "), month: " + month + " (" + dayMonthYear[1] + "), day: " + day + " (" + dayMonthYear[0] + ")");
      var trainingDate = new Date();
      trainingDate.setFullYear(year, month - 1, day);
      trainingDate.setHours(0, 0, 0, 0);
      console.log("Training date: " + trainingDate);

      var minDate = new Date();
      minDate.setDate(minDate.getDate() - 1);
      // Set 1 hour so that we include training from the day before.
      minDate.setHours(1, 0, 0, 0);
      console.log("Min date: " + minDate);

      if (minDate > trainingDate) {
        pTmpResult.push(pRow);
      }
      return this.getPassedTrainingsWithStartingCell(pRow + 1, pColumn, 0, pTmpResult);
    }
    else if (pNbRowsNoDate > 5) {
      return pTmpResult;
    }
    else {
      return this.getPassedTrainingsWithStartingCell(pRow + 1, pColumn, pNbRowsNoDate + 1, pTmpResult);
    }
  }

  /*
  Sends an email to the participants of the next training and to the admin(s) to let them know
  about participants and courts reservations.

  pTrainingDate example: "15.11.2017"

  pTcyLink example: "http://tcy.ch/online/tableau_squash.php?d=ZwNkAl0kZF0kAD=="

  pCourts example:
  [{"time": "18:45 - 19:30", "courts": [3, 4]}, {"time": "18:45 - 19:30", "courts": [3]}]

  pParticipantsToTraining example: see the output of the function getParticipantsForNextTraining.

  pAdmins example:
  ["bob@test.com", "john@test.com"]
  */
  this.sendConfirmationToParticipants = function(pTrainingDate, pTcyLink, pCourts, pParticipantsToTraining, pAdmins) {
    console.info("Starting sendConfirmationToParticipants");
    // No recipient - return immediately.
    if ((!pAdmins || pAdmins.length == 0) && (!pParticipants || pParticipants.length == 0)) {
      console.info("No recipient for confirmation email");
      return;
    }
    else {
      // Collect recipients.
      var to = "";
      if (pParticipantsToTraining) {
        for (var i = 0; i < pParticipantsToTraining.length; i++) {
          for (var j = 0; j < pParticipantsToTraining[i].participants.length; j++) {
            if (pParticipantsToTraining[i].participants[j].email) {
              if (to.indexOf(pParticipantsToTraining[i].participants[j].email) < 0) {
                to = to + pParticipantsToTraining[i].participants[j].email + ",";
              }
            }
          }
        }
      }

      if (to.match(",$"))
        to = to.substring(0, to.length - 1);
      if (to.length == 0)
        to = undefined;

      // Admins in CC.
      var cc = "";
      if (pAdmins) {
        for (var i = 0; i < pAdmins.length; i++) {
          // Do not include email several time. Also, to not add admin
          // in CC if he is in TO already (might avoid receiving duplicate emails).
          if (cc.indexOf(pAdmins[i]) < 0 && (!to || to.indexOf(pAdmins[i]) < 0)) {
            cc = cc + pAdmins[i] + ",";
          }
        }
      }
      if (cc.match(",$"))
        cc = cc.substring(0, cc.length - 1);
      if (cc.length == 0)
        cc = undefined;

      // No one to notify.
      if (!cc && !to) {
        console.info("No recipient with email for confirmation email");
        return;
      }

      // Check if training is canceled all together.
      var trainingCanceled = true;
      if (pCourts) {
        for (var i = 0; i < pCourts.length; i++) {
          if (pCourts[i].courts && pCourts[i].courts.length > 0) {
            trainingCanceled = false;
          }
        }
      }
      if (trainingCanceled) {
        var subject = "Entraînement squash du " + pTrainingDate + " annulé";
        var body = "Salut,\n\n" +
          "Merci de prendre note que tous les terrains pour l'entraînement du " + pTrainingDate + " ont été annulés en raison du faible nombre d'inscrits.\n\n" +
            "Tu peux vérifier à l'aide des liens suivants:\n\n" +
            pTcyLink + "\n" +
            this.mLinkToSpreadsheet + "\n\n" +
              "A bientôt,\n" +
                "Patrice\n\n" +
                  "-----------------------------------------\n" +
                    "Ceci est un email automatique, mais si tu réponds, je recevrai bien ta réponse.";
        var bodyHtml = "Salut,<br/><br/>\n" +
          "Merci de prendre note que tous les terrains pour l'entra&icirc;nement du " + pTrainingDate + " ont &eacute;t&eacute; annul&eacute;s en raison du faible nombre d'inscrits.<br/><br/>\n" +
            "Tu peux v&eacute;rifier à l'aide des liens suivants:<br/><br/>\n" +
            "<a href=\"" + pTcyLink + "\">R&eacute;rvations sur tcy.ch</a><br/>\n" +
            "<a href=\"" + this.mLinkToSpreadsheet + "\">Entra&icirc;nements squash Yverdon</a><br/><br/>\n" +
              "A bient&ocirc;t,<br/>\n" +
                "Patrice<br/><br/>\n" +
                  "-----------------------------------------<br/>\n" +
                    "Ceci est un email automatique, mais si tu r&eacute;ponds, je recevrai bien ta r&eacute;ponse.";

        this.sendEmail(to, cc, undefined, subject, body, bodyHtml);
        console.info("Cancellation email sent to: " + to + ", cc: " + cc + " for training on " + pTrainingDate);
      }
      else {
        // In case all courts were canceled for either the first or the second period.
        var halfCanceled = false;
        var subject = "Confrmation entraînement squash du " + pTrainingDate;
        var body = "Salut,\n\n" +
          "Merci de prendre note des réservations et inscriptions pour l'entraînement du " + pTrainingDate + ":\n\n";
        var bodyHtml = "Salut,<br/><br/>\n" +
          "Merci de prendre note des r&eacute;servations et inscriptions pour l'entra&icirc;nement du " + pTrainingDate + ":<br/><br/>\n";

        for (var i = 0; i < pCourts.length; i++) {
          body = body + "Heure: " + pCourts[i].time + "\n";
          bodyHtml = bodyHtml + "<b>Heure: " + pCourts[i].time + "</b><br/>\n";

          if (pCourts[i].courts.length > 0) {
            body = body + "Nombre de terrains: " + pCourts[i].courts.length + " (numéro";
            bodyHtml = bodyHtml + "Nombre de terrains: " + pCourts[i].courts.length + " (num&eacute;ro";
            if (pCourts[i].courts.length > 1) {
              body = body + "s";
              bodyHtml = bodyHtml + "s";
            }
            body = body + " ";
            bodyHtml = bodyHtml + " ";
            for (var j = 0; j < pCourts[i].courts.length; j++) {
              body = body + pCourts[i].courts[j];
              bodyHtml = bodyHtml + pCourts[i].courts[j];
              if (j < pCourts[i].courts.length - 1) {
                body = body + ", ";
                bodyHtml = bodyHtml + ", ";
              }
            }
            body = body + ")\n";
            bodyHtml = bodyHtml + ")<br/>\n";
            body = body + "Participants: "
            bodyHtml = bodyHtml + "Participants: "
            for (var j = 0; j < pParticipantsToTraining.length; j++) {
              if (pParticipantsToTraining[j].time == pCourts[i].time) {
                if (pParticipantsToTraining[j].participants) {
                  for (var k = 0; k < pParticipantsToTraining[j].participants.length; k++) {
                    body = body + pParticipantsToTraining[j].participants[k].name;
                    bodyHtml = bodyHtml + pParticipantsToTraining[j].participants[k].name;
                    if (k < pParticipantsToTraining[j].participants.length - 1) {
                      body = body + ", ";
                      bodyHtml = bodyHtml + ", ";
                    }
                  }
                }
              }
            }
            body = body + "\n\n";
            bodyHtml = bodyHtml + "<br/><br/>\n";
          }
          else {
            body = body + "ANNULÉ\n\n";
            bodyHtml = bodyHtml + "<b>ANNUL&Eacute;</b><br/><br/>\n";
            halfCanceled = true;
          }
        }

        var subject = "Confrmation entraînement squash du " + pTrainingDate;
        if (halfCanceled)
          subject = subject + " (attention aux terrains annulés)";


        body = body + "Tu peux vérifier à l'aide des liens suivants:\n\n" +
            pTcyLink + "\n" +
            this.mLinkToSpreadsheet + "\n\n" +
              "A bientôt,\n" +
                "Patrice\n\n" +
                  "-----------------------------------------\n" +
                    "Ceci est un email automatique, mais si tu réponds, je recevrai bien ta réponse.";

        bodyHtml = bodyHtml + "Tu peux v&eacute;rifier à l'aide des liens suivants:<br/><br/>\n" +
            "<a href=\"" + pTcyLink + "\">R&eacute;rvations sur tcy.ch</a><br/>\n" +
            "<a href=\"" + this.mLinkToSpreadsheet + "\">Entra&icirc;nements squash Yverdon</a><br/><br/>\n" +
              "A bient&ocirc;t,<br/>\n" +
                "Patrice<br/><br/>\n" +
                  "-----------------------------------------<br/>\n" +
                    "Ceci est un email automatique, mais si tu r&eacute;ponds, je recevrai bien ta r&eacute;ponse.";

        this.sendEmail(to, cc, undefined, subject, body, bodyHtml);
        console.info("Confirmation email sent to: " + to + ", cc: " + cc + " for training on " + pTrainingDate);
      }
    }
  }

  /*
  Sends an email reminder to participants who have not responded to
  the next training session if it is in less than mReminderNextTrainingInMinDays days.
  */
  this.sendReminderToParticipants = function() {
    console.info("Starting sendReminderToParticipants");
    var nextTraining = this.getNextTraining(mReminderNextTrainingInMinDays);
    if (nextTraining && !this.isReminderAlreadySent(nextTraining.row)) {
      var recipients = this.getParticipantsMissingResponse(nextTraining.row);
      if (recipients.length > 0) {
        var recipientsEmail = "";
        for (var i = 0; i < recipients.length; i++) {
          if (i > 0) {
            recipientsEmail = recipientsEmail + ",";
          }
          recipientsEmail = recipientsEmail + recipients[i].email;
        }
        console.log("Recipients email for " + nextTraining.date + ": " + recipientsEmail);
        var subject = "Rappel entraînement squash " + nextTraining.date;
        var body = "Salut,\n\n" +
          "Merci d'indiquer si tu seras présent ou absent lors du prochain entraînement (le " + nextTraining.date + ") sur la feuille en lien ci-dessous.\n\n" +
          this.mLinkToSpreadsheet + "\n\n" +
            "Les terrains seront automatiquement annulés ce soir (vers 20:00) s'il n'y a pas assez d'inscrits.\n\n" +
          "A bientôt,\n" +
          "Patrice\n\n" +
          "-----------------------------------------\n" +
          "Ceci est un email automatique, mais si tu réponds, je recevrai bien ta réponse.";

        var bodyHtml = "Salut,<br/><br/>\n" +
          "Merci d'indiquer si tu seras pr&eacute;sent ou absent lors du prochain entraînement (le " + nextTraining.date + ") sur la feuille en lien ci-dessous.<br/><br/>\n" +
          "<a href=\"" + this.mLinkToSpreadsheet + "\">Entra&icirc;nements squash Yverdon</a><br/><br/>\n" +
          "<b>Les terrains seront automatiquement annul&eacute;s ce soir (vers 20:00) s'il n'y a pas assez d'inscrits.</b><br/><br/>\n" +
          "A bient&ocirc;t,<br/>\n" +
          "Patrice<br/><br/>\n" +
          "-----------------------------------------<br/>\n" +
          "Ceci est un email automatique, mais si tu r&eacute;ponds, je recevrai bien ta r&eacute;ponse.";

        this.sendEmail(recipientsEmail, undefined, undefined, subject, body, bodyHtml);
        console.info("Reminder sent to " + recipientsEmail + " for training on " + nextTraining.date);
      }
      else {
        console.info("No one to notify for training on " + nextTraining.date);
      }
      // Mark as sent even if there was no recipient.
      this.setReminderSent(nextTraining.row);
    }
    else {
      console.info("No next training whose notification has not been sent was found");
    }
  }

  /*
  Returns participants with emails who have not responded yet to a given training.
  Returns a list of JSON objects like:
  {
  "name": "Bob",
  "email": "bob@test.com",
  "column": 4
  }
  */
  this.getParticipantsMissingResponse = function(pTrainingRow) {
    var p = this.getParticipantsWithEmail();
    var result = [];
    if (p.length > 0) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
      for (var i = 0; i < p.length; i++) {
        // Select 2 rows because there are always 2 periods.
        var range = sheet.getRange(pTrainingRow, p[i].column, 2, 1);
        var values = range.getValues();
        var p1 = values[0][0];
        var p2 = values[1][0];
        if (p1 == "" || p2 == "") {
          result.push(p[i]);
        }
      }

    }
    console.log("Participants who have not responded yet for " + pTrainingRow + ": " + JSON.stringify(result));
    return result;
  }

  /*
  Returns participants who confirmed they will participate to a given training session.
  Returns a list of JSON objects like:

  {
  "name": "Bob",
  "email": "bob@test.com",
  "column": 4
  }

  Note that only the one row that is provided in parameter is checked, i.e. if 2 hours are planned for
  the training session, this function will typically need to be called twice, once with pTrainingRow
  and once with pTrainingRow + 1.
  */
  this.getParticipantsResponsePositive = function(pTrainingRow) {
    var p = this.getParticipants();
    var result = [];
    if (p.length > 0) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
      for (var i = 0; i < p.length; i++) {
        var range = sheet.getRange(pTrainingRow, p[i].column, 1, 1);
        var values = range.getValues();
        var p1 = values[0][0];
        if (p1 == this.mParticipateTrainingValuePositive) {
          result.push(p[i]);
        }
      }

    }
    console.log("Participants who have responded '" + this.mParticipateTrainingValuePositive + "' for " + pTrainingRow + ": " + JSON.stringify(result));
    return result;
  }

  /*
  Returns a list of JSON objects like:

  {
  "name": "Bob",
  "email": "bob@test.com",
  "column": 4
  }

  where 'column' is obviously the column where that participant is in the grid.
  */
  this.getParticipantsWithEmail = function() {
    var result = this.getParticipantsWithStartingCell(this.mParticipantsStartRow, this.mParticipantsStartColumn, [], true);
    console.log("Participants with email: " + JSON.stringify(result));
    return result;
  }

  /*
  Returns a list of JSON objects like:

  {
  "name": "Bob",
  "email": "bob@test.com",
  "column": 4
  }

  where 'column' is obviously the column where that participant is in the grid and 'email' is optional.
  */
  this.getParticipants = function() {
    var result = this.getParticipantsWithStartingCell(this.mParticipantsStartRow, this.mParticipantsStartColumn, [], false);
    console.log("Participants: " + JSON.stringify(result));
    return result;
  }

  this.getParticipantsWithStartingCell = function(pRow, pColumn, pTmpResult, pWithEmailOnly) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    // Passing only two arguments returns a "range" with a single cell.
    var range = sheet.getRange(pRow, pColumn, 2, 1);
    var values = range.getValues();
    var name = values[0][0];

    // Recurssion stop condition.
    if (!name) {
      return pTmpResult;
    }

    var email = values[1][0];

    var json = {"name": name, "column": pColumn};

    if (email) {
      json.email = email;
    }

    if (pWithEmailOnly && email) {
      pTmpResult.push(json);
    }
    else if (!pWithEmailOnly) {
      pTmpResult.push(json);
    }
    console.log("Participant: " + JSON.stringify(json));
    return this.getParticipantsWithStartingCell(pRow, pColumn + 1, pTmpResult, pWithEmailOnly);
  }

  /*
  Returns the times and participants to the next training session, if there is a
  training session in the next mConfirmationNextTrainingInMinDays days.
  Returns undefined if no next training is found.

  Example result:

  [
  {
    "row": 4,
    "date": "15.11.2017",
    "time": "18:45 - 19:30",
    "participants": [{"name": "Bob", "email": "bob@test.com", "column": 7}, {"name": "Paul", "email": "paul@test.com", "column": 8}, {"name": "John", "column": 9} ]
  },
  {
    "row": 5,
    "date": "15.11.2017",
    "time": "19:30 - 20:15",
    "participants": [{"name": "Bob", "email": "bob@test.com", "column": 7}, {"name": "John", "column": 9}, {"name": "Michel", "email": "michel@test.com", "column": 12}, {"name": "Guy", "column": 15}]
  }
  ]

  */
  this.getParticipantsForNextTraining = function() {
    var nextTraining = this.getNextTraining(mConfirmationNextTrainingInMinDays);
    if (nextTraining && nextTraining.row) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
      // Get the times
      var range = sheet.getRange(nextTraining.row, this.mTrainingStartColumn + 1, 2, 1);
      var timeValues = range.getValues();

      var result = [];
      var particpantsFirstHour = this.getParticipantsResponsePositive(nextTraining.row);
      console.log("Participants for next training, 1st hour: " + JSON.stringify(particpantsFirstHour));
      var o = {"time": timeValues[0][0]};
      if (particpantsFirstHour) {
        o.participants = particpantsFirstHour;
      }
      o.row = nextTraining.row;
      o.date = nextTraining.date;
      result.push(o);

      var particpantsSecondHour = this.getParticipantsResponsePositive(nextTraining.row + 1);
      console.log("Participants for next training, 2nd hour: " + JSON.stringify(particpantsSecondHour));
      o = {"time": timeValues[1][0]};
      if (particpantsSecondHour) {
        o.participants = particpantsSecondHour;
      }
      o.date = nextTraining.date;
      o.row = nextTraining.row + 1;
      result.push(o);

      return result;
    }
    else {
      return undefined;
    }

  }

  /*
  Returns the row and date of the next training session, if there is a
  training session in the next pMinDays days.
  Returns undefined if no next training is found.

  Example result:

  {
  "row": 4,
  "date": "15.11.2017"
  }
  */
  this.getNextTraining = function(pMinDays) {
    var result = this.getNextTrainingWithStartingCell(this.mTrainingStartRow, this.mTrainingStartColumn, pMinDays, 0);
    console.log("Next training: " + JSON.stringify(result));
    return result;
  }

  this.getNextTrainingWithStartingCell = function(pRow, pColumn, pMinDays, pNbRowsNoDate) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var range = sheet.getRange(pRow, pColumn, 1, 1);
    var values = range.getValues();
    var dateStr = values[0][0];
    console.log("Date str: " + dateStr);
    if (dateStr) {
      var now = new Date();
      var dayMonthYear = dateStr.split(".");
      var day = parseInt(dayMonthYear[0], 10);
      var month = parseInt(dayMonthYear[1], 10);
      var year = parseInt(dayMonthYear[2], 10);
      console.log("Year: " + year + " (" + dayMonthYear[2] + "), month: " + month + " (" + dayMonthYear[1] + "), day: " + day + " (" + dayMonthYear[0] + ")");
      var trainingDate = new Date();
      trainingDate.setFullYear(year, month - 1, day);
      trainingDate.setHours(0, 0, 0, 0);
      console.log("Date: " + trainingDate);

      var maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + pMinDays);
      // Set 1 hour so that pMinDays works as it should.
      // E.g. if pMinDays == 2 and the trigger is run every day at 2:00 a.m.
      // and training in on Wednesday, then the email will be sent on Monday.
      maxDate.setHours(1, 0, 0, 0);
      console.log("Max date: " + maxDate);

      if (trainingDate < maxDate && trainingDate > now) {
        return {"row": pRow, "date": dateStr};
      }
      else {
        return this.getNextTrainingWithStartingCell(pRow + 1, pColumn, pMinDays, 0);
      }
    }
    else if (pNbRowsNoDate > 5) {
      return undefined;
    }
    else {
      return this.getNextTrainingWithStartingCell(pRow + 1, pColumn, pMinDays, pNbRowsNoDate + 1);
    }
  }

  /*
  Multiple recipients separated by comma.
  */
  this.sendEmail = function(recipients, cc, bcc, subject, body, bodyHtml) {
    var options = {};
    if (bodyHtml) {
      options.htmlBody = bodyHtml;
    }
    if (cc) {
      options.cc = cc;
    }
    if (bcc) {
      options.bcc = bcc;
    }
    var theRecipients = recipients;
    if (theRecipients === undefined)
      theRecipients = "";
    MailApp.sendEmail(theRecipients, subject, body, options);
  }

  /*
  Returns true if a reminder has already been sent for this training session, false otherwise.
  */
  this.isReminderAlreadySent = function(pTrainingRow) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var range = sheet.getRange(pTrainingRow, this.mReminderSentColumn, 1, 1);
    var values = range.getValues();
    return values[0][0] == this.mReminderSentYes;
  }

  /*
  Stores that a reminder has been sent for a given training session.
  */
  this.setReminderSent = function(pTrainingRow) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var range = sheet.getRange(pTrainingRow, this.mReminderSentColumn, 1, 1);
    range.setValue(this.mReminderSentYes);
  }

    /*
  Returns true if a confirmation has already been sent for this training session, false otherwise.
  */
  this.isConfirmationAlreadySent = function(pTrainingRow) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var range = sheet.getRange(pTrainingRow, this.mConfirmationSentColumn, 1, 1);
    var values = range.getValues();
    return values[0][0] == this.mConfirmationSentYes;
  }

  /*
  Stores that a confirmation has been sent for a given training session.
  */
  this.setConfirmationSent = function(pTrainingRow) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(this.mSheetNameFutureTrainings);
    var range = sheet.getRange(pTrainingRow, this.mConfirmationSentColumn, 1, 1);
    range.setValue(this.mConfirmationSentYes);
  }
}

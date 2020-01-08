/*
Utils to allow to programatically cancel reservations from http://tcy.ch/online/tableau_squash.php
No API is available, so it requires some hacks and reverse engineering.
*/

var TCY = function() {

  this.mTcyBaseUrl = "http://tcy.ch/online/";
  // For some reason, numbers on the cancellation page are off by that number...
  this.courtsNumbersOffset = -7;

  /*
  Return the HTML source for a given date, given by its code (e.g. "ZwNkAl0kZF0lZt==").
  */
  this.getDateHtmlSource = function(pDateCode) {
    var options = {
      followRedirects : false
    };
    var response = UrlFetchApp.fetch(this.mTcyBaseUrl + "tableau_squash.php?d=" + pDateCode, options);
    if (response.getResponseCode() == 200) {
      return response.getContentText();
    }
    else {
      return undefined;
    }
  }
  /*
  Given a date like "15.11.2017", return a link like "http://tcy.ch/online/tableau_squash.php?d=ZwNkAl0kZF0kAD==".
  */
  this.getReservationLink = function(pDate) {
    return this.mTcyBaseUrl + "tableau_squash.php?d=" + this.getCodeForDate(pDate);
  }

  /*
  Return a list containing all cancellation codes (e.g. ["ZmHjZQHl", "ZmD1AQp2"]) contained in a given HTML source (pPageContent)
  for a given user (pUser), e.g. "ENTRAÎNEMENT SQUASH".
  Those codes can then for example be used with the page annulation.php.
  */
  this.findCancellationCodes = function(pPageContent, pUser) {
    if (pPageContent) {

      var re = new RegExp('cases"  style="cursor:pointer;text-decoration:underline;" onClick="window.location=\'annulation.php\\?d=(.+)\'; return false;" title="' + pUser, 'g');

      //var matches = pPageContent.match(re);

      var result = [];

      var match = re.exec(pPageContent);
      while (match != null) {
        result.push(match[1]);
        match = re.exec(pPageContent);
      }
      return result;
    }
  }

  /*
  Return the HTML source for a given date, given by its code (e.g. "ZwNkAl0kZF0lZt==").
  */
  this.getCancellationPageHtmlSource = function(pCancellationCode) {
    var options = {
      followRedirects : false
    };
    var response = UrlFetchApp.fetch(this.mTcyBaseUrl + "annulation.php?d=" + pCancellationCode, options);
    if (response.getResponseCode() == 200) {
      return response.getContentText();
    }
    else {
      return undefined;
    }
  }

  /*
  Cancel the a reservation given by its pCancellationCode thanks to the given pPassword.

  Returns the response code of the POST request, but it might be 200 even if the cancellation was
  not successful, so it is up to the client to double check that it was indeed canceled.
  */
  this.cancelReservation = function(pCancellationCode, pPassword) {
    var options = {
      followRedirects : false,
      method : 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: "pwd=" + pPassword + "&annulation=annulation"
    };
    var response = UrlFetchApp.fetch(this.mTcyBaseUrl + "annulation.php?d=" + pCancellationCode, options);
    return response.getResponseCode();
  }

  this.getCancellationTimeAndCourt = function(pPageContent) {
    if (pPageContent) {
      // Time.
      var re = new RegExp(' ([0-9]+:[0-9]+)</span>', 'g');

      var result = [];

      var match = re.exec(pPageContent);
      while (match != null) {
        result.push(match[1]);
        match = re.exec(pPageContent);
      }
      var theTime = undefined;
      if (result.length > 1)
        throw "Found more than one time (" + result + ") in " + pPageContent;
      else if (result.length == 1)
        theTime = result[0];

      // Court.
      re = new RegExp('Court no ([0-9]+)', 'g');

      result = [];

      match = re.exec(pPageContent);
      while (match != null) {
        result.push(match[1]);
        match = re.exec(pPageContent);
      }
      var theCourt = undefined;
      if (result.length > 1)
        throw "Found more than one court (" + result + ") in " + pPageContent;
      else if (result.length == 1)
        theCourt = parseInt(result[0], 10) + this.courtsNumbersOffset;

      return {time: theTime, court: theCourt};
    }
  }

  /*
  Given a string that looks liks "8.12.2017", returns a JSON object where the values
  the fields "year", "month" and "day" are the string representations of the corresponding fields,
  with a fived length: 4 for the year, 2 for the month and 2 for the day, e.g.:

  {
  "year": "2017",
  "month": "12",
  "day": "08"
  }
  */
  this.getJsonFromDateString = function(pDate) {
    var dayMonthYear = pDate.split(".");
    var day = dayMonthYear[0];
    if (day.length < 2)
      day = "0" + day;
    var month = dayMonthYear[1];
    if (month.length < 2)
      month = "0" + month;
    var year = dayMonthYear[2];
    return {year: year, month: month, day: day};
  }


  /*
  Given the proper codes for the day, month and year, returns the code for the entire date.
  */
  this.getCodeForDateFromCodes = function(pDayCode, pMonthCode, pYearCode) {
    return pYearCode + "0" + pMonthCode + "0" + pDayCode + "==";
  }

  /*
  Given a date that looks like "22.11.2017", return the TCY code which looks like "ZwNkAl0kZF0lZt==".
  */
  this.getCodeForDate = function(pDate) {
    var j = this.getJsonFromDateString(pDate);
    return this.getCodeForDateFromCodes(this.getCodeForDay(j.day), this.getCodeForMonth(j.month), this.getCodeForYear(j.year));
  }

  /*
  Returns the code for a given year provided as a string of length 4.
  E.g. "2017" --> "ZwNkAl"
  */
  this.getCodeForYear = function(pYear) {
    if (pYear.length != 4)
      throw "Expected 4 characters, which is not the case with '" + pYear + "'";

    var result = "";

    var charThree = pYear.charAt(2);
    if (charThree == "1")
      result = result + "k";
    else if (charThree == "2")
      result = result + "l";
    else if (charThree == "3")
      result = result + "m";
    else if (charThree == "4")
      result = result + "n";
    else if (charThree == "5")
      result = result + "o";
    else if (charThree == "6")
      result = result + "p";
    else if (charThree == "7")
      result = result + "q";
    else if (charThree == "8")
      result = result + "r";
    else if (charThree == "9")
      result = result + "s";
    else
      throw "Unexpected character: '" + charThree + "'";


    var charFour = pYear.charAt(3);
    if (charFour == "0")
      result = result + "ZP";
    else if (charFour == "1")
      result = result + "ZF";
    else if (charFour == "2")
      result = result + "Zv";
    else if (charFour == "3")
      result = result + "Zl";
    else if (charFour == "4")
      result = result + "AP";
    else if (charFour == "5")
      result = result + "AF";
    else if (charFour == "6")
      result = result + "Av";
    else if (charFour == "7")
      result = result + "Al";
    else if (charFour == "8")
      result = result + "BP";
    else if (charFour == "9")
      result = result + "BF";
    else
      throw "Unexpected character: '" + charFour + "'";

    // "ZwN" is for the "20XX" piece.
    return "ZwN" + result;
  }

  /*
  Returns the code for a given month provided as a string of length 2.
  E.g. "11" --> "kZF"
  */
  this.getCodeForMonth = function(pMonth) {
    if (pMonth.length != 2)
      throw "Expected 2 characters, which is not the case with '" + pMonth + "'";

    var result = "";

    var charOne = pMonth.charAt(0);
    if (charOne == "0")
      result = result + "j";
    else if (charOne == "1")
      result = result + "k";
    else
      throw "Unexpected character: '" + charOne + "'";


    var charTwo = pMonth.charAt(1);
    if (charTwo == "0")
      result = result + "ZP";
    else if (charTwo == "1")
      result = result + "ZF";
    else if (charTwo == "2")
      result = result + "Zv";
    else if (charTwo == "3")
      result = result + "Zl";
    else if (charTwo == "4")
      result = result + "AP";
    else if (charTwo == "5")
      result = result + "AF";
    else if (charTwo == "6")
      result = result + "Av";
    else if (charTwo == "7")
      result = result + "Al";
    else if (charTwo == "8")
      result = result + "BP";
    else if (charTwo == "9")
      result = result + "BF";
    else
      throw "Unexpected character: '" + charTwo + "'";

    return result;
  }

  /*
  Returns the code for a given day provided as a string of length 2.
  E.g. "06" --> "jAt"
  */
  this.getCodeForDay = function(pDay) {
    if (pDay.length != 2)
      throw "Expected 2 characters, which is not the case with '" + pDay + "'";

    var result = "";

    var charOne = pDay.charAt(0);
    if (charOne == "0")
      result = result + "j";
    else if (charOne == "1")
      result = result + "k";
    else if (charOne == "2")
      result = result + "l";
    else if (charOne == "3")
      result = result + "m";
    else
      throw "Unexpected character: '" + charOne + "'";


    var charTwo = pDay.charAt(1);
    if (charTwo == "0")
      result = result + "ZN";
    else if (charTwo == "1")
      result = result + "ZD";
    else if (charTwo == "2")
      result = result + "Zt";
    else if (charTwo == "3")
      result = result + "Zj";
    else if (charTwo == "4")
      result = result + "AN";
    else if (charTwo == "5")
      result = result + "AD";
    else if (charTwo == "6")
      result = result + "At";
    else if (charTwo == "7")
      result = result + "Aj";
    else if (charTwo == "8")
      result = result + "BN";
    else if (charTwo == "9")
      result = result + "BD";
    else
      throw "Unexpected character: '" + charTwo + "'";

    return result;
  }
}

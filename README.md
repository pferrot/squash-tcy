# squash-tcy

Scripts to automate the cancellation of reservations on tcy.ch from a Google Sheet.

What the scripts do:
* send an email to all players (with a valid email address) listed in the
spreadsheet who have not indicated whether they will participate in the next
training session N days before the training (N = 2 by default).
* cancel reservations depending on the number of players who indicated they
will participate.

What the script does *not* do:
* make reservations: those have to be done separately (manually).

## Usage
* create Google Sheet document with two sheets: "à venir" and "passés"
* in the "à venir" sheet:
  * add data in the rows 1-3 and columns A-F taking
    [this screenshot](doc/images/main_sheet.png) as example
    * note the formula for the number of users who will be present
    * make sure you respect the date format (DD.MM.YYYY)
    * cells G3 - AA3 must either contain a valid email address (that of the
      player) or be empty
    * cells G4 - AA99 should be formated to only allow the values "Présent" or
      "Absent" (drop down list)
* in the "passés" sheet:
  * only add data in the first row taking
    [this screenshot](doc/images/history_sheet.png) as example
* make sure you make the document write accessible to all players so they can
  make edits (i.e. say whether they will be present or not)
* enter the script editor (Tools -> Script editor) and add the three files
  `main.gs`, `squash_training.gs` and `tcy.gs` that you can find in the `src`
  folder (see [this screenshot](doc/images/script_editor.png))
* edit the file `main.gs` and replace all occurrences of `XXXXXXXXXXXXXXXXXXXX`
  with the proper values for your environment:
  * valid tcy.ch username/password which must correspond to those that were
    used to make the reservations
  * valid admin email address(es)
* create the triggers that will take care of sending reminders and cancelling
  the reservations when needed taking
  [this screenshot](doc/images/triggers.png) as an example
  (Edit -> Current project's trigger)

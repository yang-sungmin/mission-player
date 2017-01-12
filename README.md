#GCS log repeater

* main.js: runs selected log file, mimicking pixhawk's behavior
* log_convert.js: convert mongodb dump geneated by `mongoexport` to mavlink-friendly separate logs according to time, and also generates missions
* mission_extract.js: extract missions from log file

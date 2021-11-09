 
var moment = require('moment');
const date = "2021-05-18T05:00:00.325Z"

const time = Date.parse(date)

let timestamp = moment(parseInt(time)).format("YYYY-MM-DD HH:mm:ss")

console.log(timestamp);
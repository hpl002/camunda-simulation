const {Common} = require("./common")
const {MathHelper} = require("./math")

//console.log(Common.isoToMilliseconds("PT1M"));


console.log(MathHelper.normalDistribution({mean:"PT10M", sd:"PT10M"})/60000);
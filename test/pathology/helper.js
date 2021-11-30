const { parse } = require('json2csv');
const fs = require("fs")

const convert = ({ dir, source, target }) => {
    let log = fs.readFileSync(`${dir}/${source}`);
    log = JSON.parse(log);
    log = Object.values(log)
    log = log.flat()

    const csv = parse(log, { fields: ['case_id', 'activity_id', 'activity_start', "resource_id", "activity_end"] });
    fs.writeFile(`${dir}/${target}`,csv, (err) => {
        if (err)
          console.log(err);
        else {
          console.log("File written successfully\n");               
        }
      });
     
}



convert({ dir: `${process.env.PWD}/test/pathology/data/experiment1`, source: "log.json", target: "log.csv" })
convert({ dir: `${process.env.PWD}/test/pathology/data/experiment2`, source: "log.json", target: "log.csv" })
convert({ dir: `${process.env.PWD}/test/pathology/data/experiment3`, source: "log.json", target: "log.csv" })
convert({ dir: `${process.env.PWD}/test/pathology/data/experiment4`, source: "log.json", target: "log.csv" })
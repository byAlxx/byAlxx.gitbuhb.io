import { createServer } from 'http';
import { readFile } from 'fs';

const hostname = '127.0.0.1';
const port = 3000;

const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    readFile('site.html', function (error, data) {
        if (error) {
            res.writeHead(404);
            res.write('Error: File Not Found');
        } else {
            res.write(data);
        }
        res.end();
    })
    getTranscript();
    return res.end();
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

function getTranscript() {

    const fetch = require('node-fetch');
    const fs = require('fs');
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser();

    const start_time = Date.now();
    const url = "https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/getLoadIndicator";

    fetch(url)
        .then(res => res.text())
        .then(data => {
            console.log(data);
            if (parseInt(data) < 2) {
                console.log("Continue");
                const url = "https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runPipeline";
                const formdata = new FormData();
                formdata.append('SIGNAL', fs.createReadStream('code/maus/testFull.mp3'), 'audio/mp3');
                formdata.append('TEXT', fs.createReadStream('code/maus/testFull.txt'), 'text/txt');
                formdata.append('LANGUAGE', 'deu-DE');
                formdata.append('OUTFORMAT', 'eaf');
                formdata.append('PIPE', 'G2P_CHUNKER_MAUS');

                fetch(url, {
                    method: 'POST',
                    body: formdata
                })
                    .then(res => res.text())
                    .then(data => {
                        console.log(data);
                        parser.parseString(data, (err, result) => {
                            if (err) {
                                console.error(err);
                            } else {
                                const downloadLink = result.downloadLink;
                                fetch(downloadLink)
                                    .then(res => res.text())
                                    .then(data => {
                                        fs.appendFileSync("code/maus/result.txt", data);
                                    })
                                    .catch(err => console.error(err));
                            }
                        });
                    })
                    .catch(err => console.error(err));
            }
        })
        .catch(err => console.error(err));

    console.log("--- " + (Date.now() - start_time) / 1000 + " seconds ---");
}
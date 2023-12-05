import WaveSurfer from './node_modules/wavesurfer.js/dist/wavesurfer.js';
import RegionsPlugin from './node_modules/wavesurfer.js/dist/plugins/regions.js';
import MinimapPlugin from './node_modules/wavesurfer.js/dist/plugins/minimap.js';

var wavesurfer;
var wavesurferRegions;
var wavesurferMinimap;
var wavesurferElan;
var totalAudioDuration;
var audioFile;
var audioBuffer;
var arrBuffer;
var processedAudio;

var alreadyDone = true;
var renderedAlignable;

async function readAndDecodeAudio() {
    arrBuffer = null;
    audioBuffer = null;

    //Read the original Audio
    await readAudio(audioFile)
        .then((results) => {
            arrBuffer = results.result;
        })
        .catch((error) => {
            window.alert("Some Error occured");
            return;
        });

    //Decode the original Audio into audioBuffer
    await new AudioContext().decodeAudioData(arrBuffer)
        .then((res) => {
            audioBuffer = res;
            //console.log(audioBuffer);
        })
        .catch((err) => {
            window.alert("Can't decode Audio");
            return;
        });
}

async function trimAudio(region) {
    //Create empty buffer and then put the slice of audioBuffer i.e wanted part
    var regionDuration = region.end - region.start;
    var startPoint = Math.floor((region.start * audioBuffer.length) / totalAudioDuration);
    var endPoint = Math.ceil((region.end * audioBuffer.length) / totalAudioDuration);
    var audioLength = endPoint - startPoint;

    var trimmedAudio = new AudioContext().createBuffer(
        audioBuffer.numberOfChannels,
        audioLength,
        audioBuffer.sampleRate
    );

    for (var i = 0; i < audioBuffer.numberOfChannels; i++) {
        trimmedAudio.copyToChannel(audioBuffer.getChannelData(i).slice(startPoint, endPoint), i);
    }

    var audioData = {
        channels: Array.apply(null, { length: trimmedAudio.numberOfChannels })
            .map(function (currentElement, index) {
                return trimmedAudio.getChannelData(index);
            }),
        sampleRate: trimmedAudio.sampleRate,
        length: trimmedAudio.length,
    }

    var temp = null;
    await encodeAudioBufferLame(audioData)
        .then((res) => {
            //console.log(res);
        })
        .catch((c) => {
            console.log(c);
        });
    //console.log(audioData);
}

var audioSegFile;
function encodeAudioBufferLame(audioData) {
    return new Promise((resolve, reject) => {
        var worker = new Worker('./worker/worker.js');

        worker.onmessage = (event) => {
            //console.log(event.data);
            if (event.data != null) {
                resolve(event.data);
            }
            else {
                reject("Error");
            }
            var blob = new Blob(event.data.res, { type: 'audio/mp3' });
            audioSegFile = new File([blob], 'output.mp3', { type: "audio/mp3" });
            //console.log(audioSegFile);

            startCheckUp(audioSegFile, textSegFile);

            // Not used due to MAUS Call
            //processedAudio = new window.Audio();
            //processedAudio.src = URL.createObjectURL(blob);
            //console.log(blob);
        };

        worker.postMessage({ 'audioData': audioData });
    });
}

var element1 = document.getElementById("audio-file");
element1.addEventListener("change", () => {
    console.log("Loading Audio File");
    var element = document.getElementById("audio-file");
    if (element.files[0].type !== "audio/mpeg") {
        alert("Invalid Format");
        return;
    }

    audioFile = element.files[0];
    if (wavesurfer !== undefined)
        wavesurfer.destroy();
    // Create an instance of WaveSurfer
    wavesurfer = WaveSurfer.create({
        container: '#waveform1',
        waveColor: 'rgb(200, 0, 200)',
        progressColor: 'rgb(100, 0, 100)',
        minPxPerSec: 70
    });
    // Initialize the Regions plugin
    wavesurferRegions = wavesurfer.registerPlugin(RegionsPlugin.create());

    // Initialize the Minimap plugin
    wavesurferMinimap = wavesurfer.registerPlugin(MinimapPlugin.create({
        height: 20,
        waveColor: '#ddd',
        progressColor: '#999',
        // the Minimap takes all the same options as the WaveSurfer itself
    }));

    // Give regions a random color when they are created
    const random = (min, max) => Math.random() * (max - min) + min
    const randomColor = () => `rgba({random(0, 255)}, {random(0, 255)}, {random(0, 255)}, 0.5)`

    wavesurfer.on('ready', function () {
        totalAudioDuration = wavesurfer.getDuration();
        document.getElementById('time-total').innerText = totalAudioDuration.toFixed(1);


        showAndHideTranscribeOption();
        readAndDecodeAudio();
    });

    wavesurferRegions.enableDragSelection({
        color: 'rgba(255, 0, 0, 0.1)',
    });

    wavesurferRegions.on('region-updated', (region) => {
        //console.log('Updated region', region);
        var tableRow = document.getElementById(region.id);
        //console.log(tableRow);
        tableRow.childNodes[1].innerText = region.start.toFixed(3);
        tableRow.childNodes[2].innerText = region.end.toFixed(3);
        sortAudioRows();
    });

    // Loop a region on click
    let loop = false;
    // Toggle looping with a checkbox
    document.querySelector('input[type="checkbox"]').onclick = (e) => {
        loop = e.target.checked;
    };

    let activeRegion = null;
    wavesurferRegions.on('region-in', (region) => {
        activeRegion = region;
        region.setOptions({ color: "#bb85bb50" });
    });
    wavesurferRegions.on('region-out', (region) => {
        if (activeRegion === region) {
            if (loop) {
                region.play();
            } else {
                activeRegion = null;
            }
        }
        var treffer = false;
        wavesurferRegions.regions.forEach((reg) => {
            if (reg == region) {
                treffer = true;
            }
        });
        // fixed: old region gibt es nicht mehr wie überprüfen?
        if (treffer) {
            region.setOptions({ color: "#6d6d6d50" });
        }
    });

    // Play a region on click
    wavesurferRegions.on('region-clicked', (region, e) => {
        e.stopPropagation(); // prevent triggering a click on the waveform
        activeRegion = region;
        region.play();
        region.setOptions({ color: randomColor() });
    });

    // Reset the active region when the user clicks anywhere in the waveform
    wavesurfer.on('interaction', () => {
        activeRegion = null;
    });

    // Update the zoom level on slider change + activate play/pause interaction playAndPause()
    wavesurfer.once('decode', () => {
        document.querySelector('input[type="range"]').oninput = (e) => {
            const minPxPerSec = Number(e.target.value);
            wavesurfer.zoom(minPxPerSec);
        }

        document.getElementById("audio-button").addEventListener('click', () => {
            var icon = document.getElementById("play-pause-icon");
            if (icon.className === "fa fa-play") {
                icon.className = "fa fa-pause";
                wavesurfer.play();
            } else {
                icon.className = "fa fa-play";
                wavesurfer.pause();
            }
        })
    });

    wavesurfer.on('finish', () => {
        enableAudioControls();
        console.log("Finished playing one time whole track");
        // Enabling Karaoke Mode
        document.getElementById("karaoke-option").classList.remove("w3-hide");
        openKaraokeDisplay();
    });

    wavesurfer.load(URL.createObjectURL(element.files[0]));

    wavesurfer.on('audioprocess', () => {
        if (wavesurfer.isPlaying()) {
            var currentTime = wavesurfer.getCurrentTime();
            document.getElementById('time-current').innerText = currentTime.toFixed(1);
            var icon = document.getElementById("play-pause-icon");
            if (icon.className === "fa fa-play") {
                icon.className = "fa fa-pause";
            }
        }
    });

    wavesurferRegions.on('region-created', (newRegion) => {
        //console.log('Created region', newRegion);
        //newRegion.setContent(newRegion.id);
        var audioTracks = document.getElementById("audio-tracks").tBodies[0];
        //console.log(audioTracks.childNodes);
        var tableRow = createAudioRow(new Array(newRegion.id, newRegion.start, newRegion.end, newRegion.content));
        audioTracks.appendChild(tableRow);
        if (audioTracks.childNodes.length >= 3) {
            sortAudioRows();
        }
        //showAndHideMergeOption();
    });

    wavesurfer.on('region-update-end', (newRegion) => {
        document.getElementById(newRegion.id + 1).innerText =
            (0 >= newRegion.start.toFixed(3) ? 0 : newRegion.start.toFixed(3));
        document.getElementById(newRegion.id + 2).innerText =
            (wavesurfer.getDuration() <= newRegion.end ? wavesurfer.getDuration().toFixed(3) : newRegion.end.toFixed(3));
    });

    // Elan Scrolling
    let prevAnnotation, prevSpan;
    let container = document.getElementById("tbody");
    let onProgress = function (time) {
        let annotation = getRenderedAnnotation(time);

        if (prevAnnotation != annotation) {
            prevAnnotation = annotation;

            if (annotation) {
                // Highlight word annotation in summary 
                let span = getAnnotationNode(annotation);
                prevSpan && prevSpan.classList.remove('success');
                prevSpan = span;
                span.classList.add('success');

                // Highlight annotation table row
                if (activeRegion != null) {
                    let row = document.getElementById(activeRegion.id);
                    let before = row.previousSibling;
                    if (before) {
                        container.scrollTop = before.offsetTop;// + 50; // Damit immer erste Zeile oben; height = 50px je Zeile
                    }
                }
            }
        }
    };

    wavesurfer.on('audioprocess', onProgress);

    // After all is finished
    enableAudioControls();
});


function readAudio(file) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.readAsArrayBuffer(file);

        //Resolve if audio gets loaded
        reader.onload = function () {
            console.log("Audio Loaded");
            resolve(reader);
        }

        reader.onerror = function (error) {
            console.log("Error while reading audio");
            reject(error);
        }

        reader.onabort = function (abort) {
            console.log("Aborted");
            console.log(abort);
            reject(abort);
        }
    });
}



function enableAudioControls() {
    var audioControl = document.getElementById("audio-controls");
    var audioControlClass = audioControl.getAttribute("class").replace("w3-hide", "w3-show");
    audioControl.setAttribute("class", audioControlClass);
    // Hide Help Text
    var helpText = document.getElementById("help");
    var helpTextClass = helpText.getAttribute("class").replace("w3-show", "w3-hide");
    helpText.setAttribute("class", helpTextClass);
};

function playTrack(regionId) {
    wavesurferRegions.regions.forEach(element => {
        if (element.id == regionId) {
            element.play();
        }
    });
}

function downloadTrack(regionId) {
    wavesurferRegions.regions.forEach(element => {
        if (element.id == regionId) {
            trimAudio(element);
        }
    });
}

function deleteTrack(regionId) {
    var track = document.getElementById(regionId);
    track.parentNode.removeChild(track);
    wavesurferRegions.regions.forEach(element => {
        if (element.id == regionId) {
            // delete from srt etc.
            srt_array.splice(element.content - 1, 1);
            // delete region
            element.remove();
        }
    });
    //showAndHideMergeOption();
}

var wordCounter = 0;
function createAudioRow(arr) {
    var tableRow = document.createElement("tr");
    tableRow.setAttribute("id", arr[0]);
    tableRow.setAttribute("class", "w3-hover-text-purple");
    // TODO Work not when editing 
    //tableRow.addEventListener("click", () => {
    //    wavesurferRegions.regions.forEach(element => {
    //        if (element.id == arr[0]) {
    //            element.play();
    //        }
    //    });
    //});

    for (var i in arr) {
        var tableData
        var editingCheck = false;
        if (i == 0) {
            var rows = document.getElementById("tbody");
            tableData = document.createElement("td");
            tableData.innerText = rows.childNodes.length + 1; // Bei 1 beginnen mit Segment Anzahl?
            tableRow.appendChild(tableData);
        }
        if (i == 1) {
            tableData = document.createElement("td");
            tableData.innerText = arr[i].toFixed(3);
        }
        if (i == 2) {
            tableData = document.createElement("td");
            tableData.innerText = arr[i].toFixed(3);
        }
        if (i == 3) {
            if (srt_array == undefined || srt_array.length < wavesurferRegions.regions.length) {
                tableData = document.createElement("td");
                tableData.setAttribute("class", "fullWidth");
                tableData.innerText = "\"Insert Transcript Here\"";
                // console.log("Erneut leere Zeile");
            } else {
                // console.log(srt_array);
                // FIXME wordCount darf nicht immer wieder von vorne beginnen
                srt_array.forEach((segment) => {
                    if (arr[i].innerText == segment.id) {
                        tableData = document.createElement("td");
                        tableData.setAttribute("class", "fullWidth");

                        var textSegment = document.createElement("span");
                        textSegment.setAttribute("id", "segment-" + segment.id);
                        let segText = segment.text;
                        let segArray = segText.split(" ");
                        //console.log(segArray);
                        segArray.forEach((word) => {
                            var wordSegment = document.createElement("span");
                            wordSegment.setAttribute("id", "word-a" + wordCounter);
                            wordSegment.innerText = word;
                            textSegment.append(wordSegment);
                            textSegment.append(" ");
                            wordCounter++;
                        })
                        tableData.appendChild(textSegment);
                    }
                });
            }
        }

        tableData.setAttribute("id", arr[0] + i);
        tableRow.appendChild(tableData);
    }

    var actionsArray = new Array(
        //{ "action": "play", "iconClass": "fa fa-play-circle-o" }, // Stattdessen den Text angezeigt bekommen und Editieren
        { "action": "edit", "iconClass": "fa fa-pencil" }, // braucht es das noch?
        { "action": "delete", "iconClass": "fa fa-times" });
    for (var i = 0; i < actionsArray.length; i++) {
        var tableData = document.createElement("td");
        tableData.setAttribute("id", arr[0] + "-" + actionsArray[i].action);
        var dataIcon = document.createElement("button");
        dataIcon.setAttribute("title", actionsArray[i].action);
        dataIcon.setAttribute("class", actionsArray[i].iconClass + " w3-button w3-white w3-border w3-border-light-purple w3-round-large");
        dataIcon.setAttribute("id", arr[0] + "-" + actionsArray[i].iconClass);
        // FIXME for each action seperate EventListener
        if (i == 0) {
            dataIcon.addEventListener("click", () => {
                console.log("Switching Editing Mode");
                editingCheck = !editingCheck;
                if (editingCheck) {
                    startEditing(tableRow);
                } else {
                    saveEditing(tableRow);
                }
            });
        }
        if (i == 1) {
            dataIcon.addEventListener("click", () => {
                deleteTrack(arr[0]);
            });
        }

        tableData.appendChild(dataIcon);
        tableRow.appendChild(tableData);
    }
    return tableRow;
}

function showAndHideMergeOption() {
    var audioTracks = document.getElementById("audio-tracks");
    var mergeOption = document.getElementById('merge-option');
    if (audioTracks.childNodes.length >= 4) {
        mergeOption.setAttribute('class', 'w3-show');
    } else {
        mergeOption.setAttribute('class', 'w3-hide');
    }
}

var transcribed = false;

function showAndHideTranscribeOption() {
    var transcribeOption = document.getElementById('asr-option');
    if (!transcribed) {
        transcribeOption.setAttribute('class', 'w3-show');
    } else {
        transcribeOption.setAttribute('class', 'w3-hide');
    }
}

function downloadAudio() {
    var anchorAudio = document.createElement("a");
    anchorAudio.href = processedAudio.src;
    anchorAudio.download = "output.mp3";
    anchorAudio.click();
    console.log(anchorAudio);
}

var textFile;
fetch("audio/part1.txt")
    .then(function (response) {
        return response.text();
    })
    .then(function (text) {
        var blob = new Blob([text], { type: "text/txt" });
        textFile = new File([blob], 'part1.txt', { type: "text/txt" });
    })
    .catch(function (error) {
        console.log("error: " + error);
    });

var element = document.getElementById('audio-file');
var audioFile = element.files[0];

// MAUS Call 
async function getTranscript(audioFile, textFile) {

    console.log("Start Server Request");
    const start_time = Date.now();
    const url = "https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/getLoadIndicator";

    //console.log(audioFile);
    //console.log(textFile);

    fetch(url)
        .then(res => res.text())
        .then(data => {
            console.log("Server LoadIndicator: " + data);
            if (parseInt(data) < 2) {
                console.log("Continue");
                const url = "https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runPipeline";
                const formdata = new FormData();
                formdata.append('TEXT', textFile);
                formdata.append('SIGNAL', audioFile);
                formdata.append('LANGUAGE', 'deu-DE');
                formdata.append('OUTFORMAT', 'eaf');
                formdata.append('PIPE', 'G2P_CHUNKER_MAUS');

                fetch(url, {
                    method: 'POST',
                    body: formdata
                })
                    .then(res => {
                        if (res.ok) {
                            console.log("Handling Response");
                            return res.text();
                        }
                    })
                    .then(result => {
                        //console.log(result);
                        const parserXML = new DOMParser();
                        const xmlResponse = parserXML.parseFromString(result, "text/xml");
                        //console.log(xmlResponse);
                        const downloadLink = xmlResponse.getElementsByTagName("downloadLink")[0].childNodes[0].nodeValue;
                        //console.log(downloadLink);
                        fetch(downloadLink)
                            .then(res => { return res.text() })
                            .then(data => {
                                const xml2Response = parserXML.parseFromString(data, "text/xml");
                                //console.log(xml2Response);

                                // Davor Abgleich mit alter XML damit Stelle ersetzt?
                                xmlData = parseElan(xml2Response);
                                render();
                                // Create new region(?) + Update ELAN Segment? -> neues SRT Parsing
                                //var resultFile = new File(data, "result.txt"); 
                                //console.log(resultFile);
                                //console.log("--- " + (Date.now() - start_time) / 1000 + " seconds ---");
                                // hide technical challenges
                                // var loadingPopUp = document.getElementById("loadingPopUp");
                                // var loadingPopUpClass = loadingPopUp.getAttribute("class").replace("w3-show", "w3-hide");
                                // loadingPopUp.setAttribute("class", loadingPopUpClass);
                            })
                            .catch(err => console.error("Error am Ende: " + err));

                    })
                    .catch(err => console.error("Error im Zweiten Schritt: " + err));
            } else {
                console.log("Server Load To High!");
            }
        })
        .catch(err => console.error("Error am Anfang: " + err));
}

var element = document.getElementById("transcribeButton");
element.addEventListener("click", () => {
    //goPython();
    //getTranscript();
    //loadTranscript();
    //loadMAUSTranscript();


    loadWhisperAISRTTranscript();
    load("./audio/part1.xml");
    transcribed = true;
    showAndHideTranscribeOption();
});

var speicher;

function appendData(data) {
    //console.log(data);
    speicher = data;
    document.getElementById("summary").innerHTML = JSON.stringify(data.text);
    //editor.value = JSON.stringify(data.text);

    data.segments.forEach(segment => {
        createRegion(segment.id, segment.start, segment.end, segment.text);
    });
}

function loadTranscript() {
    fetch("audio/part1.json").then(function (response) {
        return response.json();
    }).then(function (data) {
        appendData(data);
    }).catch(function (error) {
        console.log("error: " + error);
    });
}

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba({random(0, 255)}, {random(0, 255)}, {random(0, 255)}, 0.5)`

function createRegion(id, start, end, text) {
    wavesurferRegions.addRegion({
        start: start,
        end: end,
        content: "" + id,
        drag: false,
        resize: false
    });
}

function loadMAUSTranscript() {
    fetch("audio/part1_annot.json").then(function (response) {
        return response.json();
    }).then(function (data) {
        parseJSON(data);
    }).catch(function (error) {
        console.log("error: " + error);
    });
}

function parseJSON(jsonObject) {
    console.log("Printing JSON File:");
    console.log(jsonObject);
    console.log(jsonObject.levels);
}

// ELAN Parser
// Missing due to error when not transcribed with Whisper generated stuff
//load("./audio/part1.xml");
let xmlData = null;
const params = {
    url: 'transcripts/001z.xml',
    container: '#annotations',
    tiers: {
        Text: true,
        Comments: true,
        ORT: true
    }
}
const Types = {
    ALIGNABLE_ANNOTATION: 'ALIGNABLE_ANNOTATION',
    REF_ANNOTATION: 'REF_ANNOTATION'
}

function load(url) {
    loadXML(url, xml => {
        xmlData = parseElan(xml);
        render();
        //fireEvent('ready', data);
    });
}

function loadXML(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'document';
    xhr.send();
    xhr.addEventListener('load', e => {
        callback && callback(e.target.responseXML);
    });
}

function parseElan(xml) {
    const _forEach = Array.prototype.forEach;
    const _map = Array.prototype.map;

    const data = {
        media: {},
        timeOrder: {},
        tiers: [],
        annotations: {},
        alignableAnnotations: []
    };

    const header = xml.querySelector('HEADER');
    const inMilliseconds = header.getAttribute('TIME_UNITS') == 'milliseconds';
    const media = header.querySelector('MEDIA_DESCRIPTOR');
    data.media.url = media.getAttribute('MEDIA_URL');
    data.media.type = media.getAttribute('MIME_TYPE');

    const timeSlots = xml.querySelectorAll('TIME_ORDER TIME_SLOT');
    const timeOrder = {};
    _forEach.call(timeSlots, slot => {
        let value = parseFloat(slot.getAttribute('TIME_VALUE'));
        // If in milliseconds, convert to seconds with rounding
        if (inMilliseconds) {
            value = Math.round(value * 1e2) / 1e5;
        }
        timeOrder[slot.getAttribute('TIME_SLOT_ID')] = value;
    });

    data.tiers = _map.call(xml.querySelectorAll('TIER'), tier => ({
        id: tier.getAttribute('TIER_ID'),
        linguisticTypeRef: tier.getAttribute('LINGUISTIC_TYPE_REF'),
        defaultLocale: tier.getAttribute('DEFAULT_LOCALE'),
        annotations: _map.call(
            tier.querySelectorAll('REF_ANNOTATION, ALIGNABLE_ANNOTATION'), node => {
                const annot = {
                    type: node.nodeName,
                    id: node.getAttribute('ANNOTATION_ID'),
                    ref: node.getAttribute('ANNOTATION_REF'),
                    value: node.querySelector('ANNOTATION_VALUE')
                        .textContent.trim()
                };

                if (Types.ALIGNABLE_ANNOTATION == annot.type) {
                    // Add start & end to alignable annotation
                    annot.start = timeOrder[node.getAttribute('TIME_SLOT_REF1')];
                    annot.end = timeOrder[node.getAttribute('TIME_SLOT_REF2')];
                    // Add to the list of alignable annotations
                    data.alignableAnnotations.push(annot);
                }

                // Additionally, put into the flat map of all annotations
                data.annotations[annot.id] = annot;

                return annot;
            }
        )
    }));

    // Create JavaScript references between annotations
    data.tiers.forEach(tier => {
        tier.annotations.forEach(annot => {
            if (null != annot.ref) {
                annot.reference = data.annotations[annot.ref];
            }
        });
    });

    // Sort alignable annotations by start & end
    data.alignableAnnotations.sort((a, b) => {
        let d = a.start - b.start;
        if (d == 0) {
            d = b.end - a.end;
        }
        return d;
    });

    data.length = data.alignableAnnotations.length;


    //console.log(data);
    return data;
}

function render() {
    // apply tiers filter
    let tiers = xmlData.tiers;
    //console.log(params.tiers);
    if (params.tiers) {
        tiers = tiers.filter(tier => tier.id in params.tiers);
    }
    //console.log(tiers);
    // denormalize references to alignable annotations
    const backRefs = {};
    let indeces = {};
    tiers.forEach((tier, index) => {
        tier.annotations.forEach(annot => {
            if (annot.reference && annot.reference.type == Types.ALIGNABLE_ANNOTATION) {
                if ((!annot.reference.id in backRefs)) {
                    backRefs[annot.ref] = {};
                }
                backRefs[annot.ref][index] = annot;
                indeces[index] = true;
            }
        });
    });
    indeces[0] = true;
    indeces = Object.keys(indeces).sort();
    //renderedAlignable = data.alignableAnnotations.filter(alignable => backRefs[alignable.id]);
    //renderedAlignable = data.alignableAnnotations.filter(alignable => tiers[0].annotations[alignable.id]);
    renderedAlignable = xmlData.tiers[0].annotations;
    //renderedAlignable = data.alignableAnnotations;
    //console.log(renderedAlignable);

    // Not needed because each segment row needs to be filled?
    // table
    /*const table = document.createElement('table');
    table.className = 'wavesurfer-annotations';

    // head
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    thead.appendChild(headRow);
    table.appendChild(thead);
    const th = document.createElement('th');
    th.textContent = 'Time';
    th.className = 'wavesurfer-time';
    headRow.appendChild(th);
    indeces.forEach(index => {
        const tier = tiers[index];
        const th = document.createElement('th');
        th.className = 'wavesurfer-tier-' + tier.id;
        th.textContent = tier.id;
        th.style.width = params.tiers[tier.id];
        headRow.appendChild(th);
    });
    
    // body
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    renderedAlignable.forEach(alignable => {
        const row = document.createElement('tr');
        row.id = 'wavesurfer-alignable-' + alignable.id;
        tbody.appendChild(row);

        const td = document.createElement('td');
        td.className = 'wavesurfer-time';
        td.textContent = alignable.start.toFixed(1) + ' – ' +
            alignable.end.toFixed(1);
        row.appendChild(td);

        //const backRef = backRefs[alignable.id];
        //console.log(alignable);
        indeces.forEach(index => {
            const tier = tiers[index];
            const td = document.createElement('td');
            //const annotation = backRef[index];
            const annotation = alignable;
            if (annotation) {
                td.id = 'wavesurfer-annotation-' + annotation.id;
                td.dataset.ref = alignable.id;
                td.dataset.start = alignable.start;
                td.dataset.end = alignable.end;
                td.textContent = annotation.value;
            }
            td.className = 'wavesurfer-tier-' + tier.id;
            row.appendChild(td);
        });
    });
    */
    // FIXME Make Container for each Segment?
    // array.splice(start, deleteCount, item1, item2, ..., itemN)
    // array is the array that you want to modify.
    // start is the index where you want to start modifying the array.
    // deleteCount is the number of elements you want to remove from the array, starting at the start index.
    // item1, item2, and so on are the elements you want to add to the array at the start index.   
    renderedAlignableArray.push(renderedAlignable);
    // console.log(renderedAlignableArray);
    //container.innerHTML = '';
    //container.appendChild(table);
}

var renderedAlignableArray = new Array(); // For each segment push the Segment MAUS Words

var currentSeg;
function getRenderedAnnotation(time) {
    let result = false;
    var zeitverschiebung;

    wavesurferRegions.regions.forEach((region) => {
        if (region.start <= time && region.end >= time) {
            currentSeg = parseInt(region.content.innerText);
        }
    });

    // Check if used with fully generated WhisperAI transcript (var transcribed)
    if (!transcribed) {
        wavesurferRegions.regions.forEach((region) => {
            if (region.start <= time && region.end >= time) {
                zeitverschiebung = region.start;
                renderedAlignable = renderedAlignableArray[parseInt(region.content.innerText) - 1];
                // console.log(renderedAlignable);
            }
        });

        if (renderedAlignable != undefined) {
            renderedAlignable.some(annotation => {
                if (annotation.start + zeitverschiebung <= time && annotation.end + zeitverschiebung >= time) {
                    result = annotation;
                    return true;
                }
                return false;
            });
        }
    } else {
        if (renderedAlignable != undefined) {
            renderedAlignable.some(annotation => {
                if (annotation.start <= time && annotation.end >= time) {
                    result = annotation;
                    return true;
                }
                return false;
            });
        }
    }

    // console.log("renderedAlignable");
    // console.log(renderedAlignable);
    // console.log("renderedAlignableArray");
    // console.log(renderedAlignableArray);
    // console.log(result);

    return result;
}

var karaokeMode = false;
var prevWordCount = 0;
// Changed due to .srt import
function getAnnotationNode(annotation) {
    //return document.getElementById(
    //    'wavesurfer-alignable-' + annotation.id
    //);
    console.log(annotation);
    if (karaokeMode || transcribed) {
        return document.getElementById(
            'word-' + annotation.id
        );
    } else {
        return document.getElementById(
            'word-' + annotation.id
        );
        // TODO changed to 'segment-' + region.id + word -> da wir im Segment suchen wollen / erst im Karaoke Modus geht das
        // // console.log(annotation);
        // var segment = document.getElementById('segment-' + currentSeg);
        // segment.childNodes.forEach(wordNode => {
        //     if (wordNode.id == 'word-' + annotation.id) {
        //         console.log(document.getElementById(
        //             'word-' + annotation.id
        //         ));
        //         console.log(wordNode);
        //         return wordNode;
        //     }
        // });
        // return document.getElementById(
        //     'word-' + annotation.id// + prevWordCount
        // );
    }
}

// Import WhisperAI .srt Format

function loadWhisperAISRTTranscript() {
    fetch("audio/part1.srt").then(function (response) {
        return response.text();
    }).then(function (data) {
        parseSRT(data);
    }).catch(function (error) {
        console.log("error: " + error);
    });
}

var srt_array;

import srtParser2 from "./node_modules/srt-parser-2/dist/index.js";
const parser = new srtParser2();

// FIXME Check for ELAN Renderer
function parseSRT(srt_string) {
    // segMegaString = srt_string;
    srt_array = parser.fromSrt(srt_string);
    // console.log(srt_array);

    // TODO wordCounter just for each segment
    var wordCounter = 0;
    srt_array.forEach((element) => {
        createRegion(element.id, element.startSeconds, element.endSeconds, element.text);
        var textSegment = document.createElement("span");
        textSegment.setAttribute("id", "segment-" + element.id);
        let segText = element.text;
        let segArray = segText.split(" ");
        //console.log(segArray);
        segArray.forEach((word) => {
            var wordSegment = document.createElement("span");
            wordSegment.setAttribute("id", "word-a" + wordCounter);
            wordSegment.innerText = word;
            textSegment.append(wordSegment);
            textSegment.append(" ");
            wordCounter++;
        })
        document.getElementById("summary").append(textSegment);

        // TODO create for each segment visible XML Words to sync with audio but not from summary, more likely into each segment
        //document.createElement("div");
    });
    // segMegaString = parser.toSrt(srt_array);;
}

function startEditing(tableRow) {
    //console.log(tableRow.children[3]);
    // Insert Transcript + Editor
    var text = tableRow.children[3].innerText;
    var id = "#" + tableRow.id + "3";

    // TODO remodel Regions when editing transcript
    // var region = wavesurferRegions.regions[0];
    // region.setOptions({ drag: true, resize: true, color: "#ff0000" });
    // console.log(region);

    // Create new Jodit Editor
    const editor1 = Jodit.make(id, {
        toolbar: false,
        useSearch: false,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        showPlaceholder: false,
        minHeight: 50,
        buttons: []
    });

    editor1.value = text;
}

function saveEditing(tableRow) {
    // Insert Transcript + Editor
    var text = tableRow.children[3].children[0].innerText;
    var id = tableRow.id + "3";

    tableRow.children[3].remove();
    var tableData = document.createElement("td");
    tableData.innerText = text;



    tableData.setAttribute("id", id);
    tableData.setAttribute("class", "fullWidth");
    tableRow.insertBefore(tableData, tableRow.children[3]);

    updateTranscript(tableRow.id, text);
}

var segStringArray = new Array();
var segMegaString = "";

function updateTranscript(id, text) {
    var segId = parseInt(document.getElementById(id + "0").innerText);
    var newText = text;

    // Existing srt_array from generated transcript
    // if (srt_array != undefined) {
    //     var srt_string = parser.toSrt(srt_array);
    //     console.log(srt_string);
    //     parseSRT(srt_string);
    // }
    if (srt_array != undefined && srt_array.length == wavesurferRegions.regions.length) {
        // Changing srt_array specific segment
        srt_array.forEach((segment) => {
            if (segment.id == segId) {
                segment.text = newText;
            }
        });
    } else {
        // Creating srt_array from scratch with new segments
        wavesurferRegions.regions.forEach(region => {
            if (region.id == id) {
                var regionId = document.getElementById(id).childNodes[0].innerText;
                var start = region.start.toFixed(3);
                var end = region.end.toFixed(3);
                var data_array1 = {
                    id: regionId,
                    start: start,
                    end: end,
                    text: newText
                };
                //console.log(data_array1);
                var seg_SRT = inputToSRT(data_array1);
                segMegaString += seg_SRT;
                // segStringArray.push(seg_SRT);
                // segStringArray.forEach(seg => {
                // parseSRT(seg);
                // });
            }
        });
    }
    console.log(segMegaString); // des wird jetzt hier genutzt
    // console.log(segStringArray);

    // Making MAUS Call check
    checkSegment(id, newText);

    // Remove Segment Render due to creating new one with SRT Parse Function
    var tbody = document.getElementById("tbody");
    wavesurferRegions.regions.forEach(element => {
        var track = document.getElementById(element.id);
        // Remove all TableRows
        tbody.removeChild(track);
        // Remove all Regions
        element.remove();
    });

    document.getElementById("summary").innerHTML = "";
    //console.log(document.getElementById("summary"));

    // segStringArray.forEach(seg => {
    //     parseSRT(seg);
    // });

    // console.log(srt_array);

    // FIXME den Teil hier einfach oben rein packen, wo segMegaString entsteht
    if (segMegaString || srt_array == undefined) {
        parseSRT(segMegaString);
    } else {
        // Create srtString -> pass it over to parse it to array
        // console.log(srt_array);
        var srt_string = parser.toSrt(srt_array);
        console.log(srt_string);
        parseSRT(srt_string);
        srt_array = parser.fromSrt(srt_string);
        // 
    }
    // console.log(srt_array);
    // turn array back to SRT string.
    //console.log(segArray);
    //if (srt_array == undefined) {
    //    srt_array = parser.fromSrt(segStringArray);
    //    console.log("SrtArray leer also neu erstellen sollte nur einmal passieren");
    //}
}

var audioSegFile, textSegFile, done;
async function checkSegment(id, text) {
    console.log("Making Segment Check");
    // TODO disguise technic behind app
    // var loadingPopUp = document.getElementById("loadingPopUp");
    // var loadingPopUpClass = loadingPopUp.getAttribute("class").replace("w3-hide", "w3-show");
    // loadingPopUp.setAttribute("class", loadingPopUpClass);
    var blob = new Blob([text], { type: "text/txt" });
    textSegFile = new File([blob], 'output.txt', { type: "text/txt" });

    wavesurferRegions.regions.forEach(element => {
        if (element.id == id) {
            trimAudio(element);
        }
    });

    done = true;
}

function startCheckUp(audio, text) {
    if (done) {
        getTranscript(audio, text);
    }
}


const muteBtn = document.querySelector(".mute-btn");
const volumeSlider = document.querySelector(".volume-slider");

volumeSlider.addEventListener("mouseup", () => {
    changeVolume(volumeSlider.value);
})

const changeVolume = (volume) => {
    if (volume == 0) {
        muteBtn.classList.add("muted");
    } else {
        muteBtn.classList.remove("muted");
    }
    wavesurfer.setVolume(volume)
}

muteBtn.addEventListener("click", () => {
    if (muteBtn.classList.contains("muted")) {
        muteBtn.classList.remove("muted");
        wavesurfer.setVolume(0.5);
        volumeSlider.value = 0.5;
    } else {
        muteBtn.classList.add("muted");
        wavesurfer.setVolume(0);
        volumeSlider.value = 0;
    }
})

function sortAudioRows() {
    var rows = document.getElementById("tbody");
    var arr = rows.childNodes;

    let min;

    //start passes.
    for (let i = 0; i < arr.length; i++) {
        //index of the smallest element to be the ith element.
        min = i;

        //Check through the rest of the array for a lesser element
        for (let j = i + 1; j < arr.length; j++) {
            if (parseFloat(arr[j].childNodes[1].innerText) < parseFloat(arr[min].childNodes[1].innerText)) {
                min = j;
            }
        }

        //compare the indexes
        if (min !== i) {
            //swap
            //FIXME check ID Numbers sort if new Regions cerated afterwards
            rows.insertBefore(arr[min], arr[i]);
        }
    }

    return arr;
}

// TODO Implement for Silent Segments Reduction?
// Find regions separated by silence
const extractRegions = (audioData, duration) => {
    const minValue = 0.01;
    const minSilenceDuration = 0.2;
    const mergeDuration = 0.2;
    const scale = duration / audioData.length;
    const silentRegions = [];

    // Find all silent regions longer than minSilenceDuration
    let start = 0;
    let end = 0;
    let isSilent = false;
    for (let i = 0; i < audioData.length; i++) {
        if (audioData[i] < minValue) {
            if (!isSilent) {
                start = i;
                isSilent = true;
            }
        } else if (isSilent) {
            end = i;
            isSilent = false;
            if (scale * (end - start) > minSilenceDuration) {
                silentRegions.push({
                    start: scale * start,
                    end: scale * end,
                });
            }
        }
    }

    // Merge silent regions that are close together
    const mergedRegions = [];
    let lastRegion = null;
    for (let i = 0; i < silentRegions.length; i++) {
        if (lastRegion && silentRegions[i].start - lastRegion.end < mergeDuration) {
            lastRegion.end = silentRegions[i].end;
        } else {
            lastRegion = silentRegions[i];
            mergedRegions.push(lastRegion);
        }
    }

    // Find regions that are not silent
    const regions = [];
    let lastEnd = 0;
    for (let i = 0; i < mergedRegions.length; i++) {
        regions.push({
            start: lastEnd,
            end: mergedRegions[i].start,
        });
        lastEnd = mergedRegions[i].end;
    }

    return regions;
}

// SRT Parsing because external srt Parser wont help enough
var srtCount;

function srtTimestamp(seconds) {
    var milliseconds = seconds * 1000;

    var seconds = Math.floor(milliseconds / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var milliseconds = milliseconds % 1000;
    var seconds = seconds % 60;
    var minutes = minutes % 60;
    return (hours < 10 ? '0' : '') + hours + ':'
        + (minutes < 10 ? '0' : '') + minutes + ':'
        + (seconds < 10 ? '0' : '') + seconds + ','
        + (milliseconds < 100 ? '0' : '') + (milliseconds < 10 ? '0' : '') + milliseconds;
}

function inputToSRT(sub_in) {
    return sub_in.id + "\r\n" + srtTimestamp(sub_in.start) + " --> " + srtTimestamp(sub_in.end) + "\r\n" + sub_in.text + "\r\n\r\n";
}

// Karaoke Mode after all been transcribed
var karaokeBtn = document.getElementById("karaoke-option");
karaokeBtn.addEventListener("click", () => {
    openKaraokeDisplay(karaokeMode);
})

function openKaraokeDisplay(isKaraokeMode) {
    if (isKaraokeMode) {
        document.getElementById("summary").classList.add("w3-hide");
        document.getElementById("audio-tracks").classList.remove("w3-hide");
        karaokeMode = false;
    } else {
        document.getElementById("summary").classList.remove("w3-hide");
        document.getElementById("audio-tracks").classList.add("w3-hide");
        karaokeMode = true;
    }
}


// User Testing Cases
var select = document.getElementById("task-select");
select.onchange = function () {
    var selIndex = select.selectedIndex;
    // var selValue = select[selIndex].innerHTML;
    console.log(selIndex);
    switch (selIndex) {
        case 1:
            loadWhisperAISRTTranscript();
            load("./audio/part1.xml");
            transcribed = true;
            showAndHideTranscribeOption();
            break;
        case 2:
            loadHalfSRTTranscript();
            load("./audio/partly1.xml");
            document.getElementById("asr-option").classList.remove("w3-show");
            document.getElementById("asr-option").classList.add("w3-hide");
            break;
        case 3:
            document.getElementById("asr-option").classList.remove("w3-show");
            document.getElementById("asr-option").classList.add("w3-hide");
            break;

        default:
            break;
    }
}

function loadHalfSRTTranscript() {
    fetch("audio/partly1.srt").then(function (response) {
        return response.text();
    }).then(function (data) {
        parseSRT(data);
    }).catch(function (error) {
        console.log("error: " + error);
    });
}

var audioBtn = document.getElementById("downloadAudioButton");
audioBtn.addEventListener(("click"), function downloadAudioFile() {
    var anchorAudio = document.createElement("a");
    anchorAudio.href = "audio/part1.mp3";
    anchorAudio.download = "part1.mp3";
    anchorAudio.click();
    // console.log(anchorAudio);
});

var btn = document.getElementById("downloadButton");
btn.addEventListener(("click"), function downloadTranscript() {
    var anchorAudio = document.createElement("a");
    var text = parser.toSrt(srt_array);
    // console.log(text);
    var blob = new Blob([text], { type: "text/txt" });
    anchorAudio.href = URL.createObjectURL(blob);
    anchorAudio.download = "output.txt";
    anchorAudio.click();
    // console.log(anchorAudio);
});

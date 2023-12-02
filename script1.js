// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`

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


// Create some regions at specific time ranges

wavesurfer.on('decode', () => {
    // Regions
    wavesurferRegions.addRegion({
        start: 0,
        end: 8,
        content: 'Resize me',
        color: randomColor(),
        drag: false,
        resize: true,
    })
    wavesurferRegions.addRegion({
        start: 9,
        end: 10,
        content: 'Cramped region',
        color: randomColor(),
        minLength: 1,
        maxLength: 10,
    })
    wavesurferRegions.addRegion({
        start: 12,
        end: 17,
        content: 'Drag me',
        color: randomColor(),
        resize: false,
    })

    // Markers (zero-length regions)
    wavesurferRegions.addRegion({
        start: 19,
        content: 'Marker',
        color: randomColor(),
    })
    wavesurferRegions.addRegion({
        start: 20,
        content: 'Second marker',
        color: randomColor(),
    })
})

//
var wavesurfer;
var wavesurferRegions;
var audioFile;
var totalAudioDuration;
var arrBuffer;
var audioBuffer;
var processedAudio;

function showAndHideMergeOption() {
    var audioTracks = document.getElementById("audio-tracks");
    var mergeOption = document.getElementById('merge-option');
    if (audioTracks.childNodes.length >= 4) {
        mergeOption.setAttribute('class', 'w3-show');
    } else {
        mergeOption.setAttribute('class', 'w3-hide');
    }
}

function createAudioRow(arr) {
    var tableRow = document.createElement("tr");
    tableRow.setAttribute("id", arr[0]);
    tableRow.setAttribute("class", "w3-hover-text-green");
    //tableRow.setAttribute("onmouseover", "highlightRegion('over','"+arr[0]+"')");
    //tableRow.setAttribute("onmouseleave", "highlightRegion('leave','"+arr[0]+"')");
    for (var i in arr) {
        var tableData;
        if (i == 0) {
            tableData = document.createElement("input");
            tableData.setAttribute("type", "checkbox");
            tableData.setAttribute("class", "w3-check w3-margin-left");
        } else {
            tableData = document.createElement("td");
            tableData.innerText = arr[i].toFixed(4);
        }
        tableData.setAttribute("id", arr[0] + i);
        tableRow.appendChild(tableData);
    }

    var actionsArray = new Array(
        { "action": "play", "iconClass": "fa fa-play-circle-o" },
        { "action": "download", "iconClass": "fa fa-download" },
        { "action": "delete", "iconClass": "fa fa-times" });
    for (var i = 0; i < actionsArray.length; i++) {
        var tableData = document.createElement("td");
        tableData.setAttribute("id", arr[0] + "-" + actionsArray[i].action);
        var dataIcon = document.createElement("button");
        dataIcon.setAttribute("title", actionsArray[i].action);
        dataIcon.setAttribute("class", actionsArray[i].iconClass + " w3-button w3-white w3-border w3-border-light-green w3-round-large");
        dataIcon.setAttribute("id", arr[0] + "-" + actionsArray[i].iconClass);
        dataIcon.setAttribute("onClick", actionsArray[i].action + "Track('" + arr[0].toString() + "')");
        tableData.appendChild(dataIcon);
        tableRow.appendChild(tableData);
    }
    return tableRow;
}

function highlightRegion(eventName, regionId) {
    var region = wavesurfer.regions.list[regionId];
    if (eventName == "over") {
        region.color = "rgba(0, 255, 0, 0.1)";
    } else {
        wavesurfer.regions.list[regionId].color = "rgba(0, 0, 0, 0.1)";
    }
}

function playTrack(regionId) {
    wavesurfer.regions.list[regionId].play();
}

function mergeTrack() {
    var audioList = new Array();
    for (var i in wavesurfer.regions.list) {
        var region = wavesurfer.regions.list[i];
        if (document.getElementById(region.id + '0').checked) {
            document.getElementById(region.id + '0').checked = false;
            audioList.push(wavesurfer.regions.list[i]);
        }
    }
    if (audioList.length >= 2) {
        mergeAudio(audioList);
        var mergedTrackDiv = document.getElementById("merged-track-div");
        var mergedTrackDivClass = mergedTrackDiv.className.replace("w3-hide", "w3-show");
        mergedTrackDiv.setAttribute("class", mergedTrackDivClass);
        var mergedTrack = document.getElementById("merged-track");
    } else {
        alert("Select more than 1 tracks");
    }

}

function downloadTrack(regionId) {
    trimAudio(wavesurfer.regions.list[regionId]);
}

function deleteTrack(regionId) {
    var track = document.getElementById(regionId);
    track.parentNode.removeChild(track);
    wavesurfer.regions.list[regionId].remove();
    showAndHideMergeOption();
}

function setPlayButton() {
    var icon = document.getElementById("play-pause-icon");
    icon.className = "fa fa-play";
};

function preTrimUIChanges() {
    setPlayButton();
    var audioTracks = document.getElementById("audio-tracks");
    var tbody = document.createElement("tbody");
    audioTracks.tBodies[0].remove();
    audioTracks.insertBefore(tbody, audioTracks.tFoot[0]);
}

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

    })
}

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
            console.log(audioBuffer);
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
            console.log(res);
            downloadAudio();
        })
        .catch((c) => {
            console.log(c);
        });
    console.log(audioData);
}

async function mergeAudio(audioList) {
    console.log(audioList);
    var trackDetails = new Array();
    var channelLength = 0;
    for (var i in audioList) {
        var regionDuration = audioList[i].end - audioList[i].start;
        var startPoint = Math.floor((audioList[i].start * audioBuffer.length) / totalAudioDuration);
        var endPoint = Math.ceil((audioList[i].end * audioBuffer.length) / totalAudioDuration);
        var audioLength = endPoint - startPoint;
        channelLength = channelLength + audioLength;

        var trackDetail = {
            'regionDuration': regionDuration,
            'startPoint': startPoint,
            'endPoint': endPoint,
            'audioLength': audioLength
        }
        trackDetails.push(trackDetail);
    }

    var mergedAudio = new AudioContext().createBuffer(
        audioBuffer.numberOfChannels,
        channelLength,
        audioBuffer.sampleRate
    );

    var channelData = (audioBuffer.numberOfChannels === 1 ?
        new Array(new Float32Array(channelLength)) :
        new Array(new Float32Array(channelLength), new Float32Array(channelLength)));

    for (var i = 0; i < audioBuffer.numberOfChannels; i++) {
        var startLength = 0;
        for (var j in trackDetails) {
            channelData[i].set(audioBuffer.getChannelData(i).slice(
                trackDetails[j]["startPoint"], trackDetails[j]["endPoint"]), startLength);
            startLength = trackDetails[j]["audioLength"];
        }
    }

    for (var i = 0; i < audioBuffer.numberOfChannels; i++) {
        mergedAudio.copyToChannel(channelData[i], i)
    }

    var audioData = {
        channels: Array.apply(null, { length: mergedAudio.numberOfChannels })
            .map(function (currentElement, index) {
                return mergedAudio.getChannelData(index);
            }),
        sampleRate: mergedAudio.sampleRate,
        length: mergedAudio.length,
    }

    var temp = null;
    await encodeAudioBufferLame(audioData)
        .then((res) => {
            console.log(res)
            document.getElementById("merged-track").src = processedAudio.src;
        })
        .catch((c) => {
            console.log(c)
        });
    console.log(audioData);
}

function encodeAudioBufferLame(audioData) {
    return new Promise((resolve, reject) => {
        var worker = new Worker('./node_modules/worker/worker.js');

        worker.onmessage = (event) => {
            console.log(event.data);
            if (event.data != null) {
                resolve(event.data);
            }
            else {
                reject("Error");
            }
            var blob = new Blob(event.data.res, { type: 'audio/mp3' });
            processedAudio = new window.Audio();
            processedAudio.src = URL.createObjectURL(blob);
            console.log(blob);
        };

        worker.postMessage({ 'audioData': audioData });
    });
}

var element1 = document.getElementById("audio-file");
element1.addEventListener("change", function loadAudio() {
    var element = document.getElementById("audio-file");
    if (element.files[0].type !== "audio/mpeg") {
        alert("Invalid Format");
        return;
    }

    var audioFile = element.files[0];
    if (wavesurfer !== undefined)
        wavesurfer.destroy();
    wavesurfer = WaveSurfer.create({
        container: "#waveform2",
        waveColor: '#b6c3b1',
        progressColor: '#6d8764',
        responsive: true,
        barWidth: 3,
        barRadius: 3,
        cursorWidth: 1,
        height: 100,
        barGap: 3
    });
    // Initialize the Regions plugin
    wavesurferRegions = wavesurfer.registerPlugin(RegionsPlugin.create())
    wavesurfer.on('ready', function () {
        readAndDecodeAudio();
        preTrimUIChanges();
        totalAudioDuration = wavesurfer.getDuration();
        document.getElementById('time-total').innerText = totalAudioDuration.toFixed(1);
        wavesurferRegions.enableDragSelection({});
    });
    wavesurfer.on('finish', setPlayButton);
    wavesurfer.load(URL.createObjectURL(element.files[0]));
    wavesurfer.on('audioprocess', function () {
        if (wavesurfer.isPlaying()) {
            var currentTime = wavesurfer.getCurrentTime();
            document.getElementById('time-current').innerText = currentTime.toFixed(1);
        }
    });
    wavesurfer.on('region-created', function (newRegion) {
        var audioTracks = document.getElementById("audio-tracks").tBodies[0];
        console.log(audioTracks.childNodes);
        var tableRow = createAudioRow(new Array(newRegion.id, newRegion.start, newRegion.end));
        audioTracks.appendChild(tableRow);
        showAndHideMergeOption();
    });
    wavesurfer.on('region-update-end', function (newRegion) {
        document.getElementById(newRegion.id + 1).innerText =
            (0 >= newRegion.start.toFixed(4) ? 0 : newRegion.start.toFixed(4));
        document.getElementById(newRegion.id + 2).innerText =
            (wavesurfer.getDuration() <= newRegion.end ? wavesurfer.getDuration().toFixed(4) : newRegion.end.toFixed(4));
    });
    var audioButtons = document.getElementById("audio-buttons");
    var audioButtonsClass = audioButtons.getAttribute("class").replace("w3-hide", "w3-show");
    audioButtons.setAttribute("class", audioButtonsClass);
});

function downloadAudio() {
    var anchorAudio = document.createElement("a");
    anchorAudio.href = processedAudio.src;
    anchorAudio.download = "output.mp3";
    anchorAudio.click();
    console.log(anchorAudio);
}


// Create an instance of WaveSurfer
/*
const wavesurfer = WaveSurfer.create({
    container: '#waveform1',
    waveColor: 'rgb(200, 0, 200)',
    progressColor: 'rgb(100, 0, 100)',
    url: '/code/wavesurfer/audio/part1.wav',
});

const wavesurferMinimap = wavesurfer.registerPlugin(MinimapPlugin.create({
    height: 20,
    waveColor: '#ddd',
    progressColor: '#999',
    // the Minimap takes all the same options as the WaveSurfer itself
}));

// Initialize the Regions plugin
const wavesurferRegions = wavesurfer.registerPlugin(RegionsPlugin.create());

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`


// Silence Detection

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/nasa.mp4',
  minPxPerSec: 50,
  interact: false,
})

// Initialize the Regions plugin
const wsRegions = ws.registerPlugin(RegionsPlugin.create())

// Find regions separated by silence
const extractRegions = (audioData, duration) => {
  const minValue = 0.01
  const minSilenceDuration = 0.1
  const mergeDuration = 0.2
  const scale = duration / audioData.length
  const silentRegions = []

  // Find all silent regions longer than minSilenceDuration
  let start = 0
  let end = 0
  let isSilent = false
  for (let i = 0; i < audioData.length; i++) {
    if (audioData[i] < minValue) {
      if (!isSilent) {
        start = i
        isSilent = true
      }
    } else if (isSilent) {
      end = i
      isSilent = false
      if (scale * (end - start) > minSilenceDuration) {
        silentRegions.push({
          start: scale * start,
          end: scale * end,
        })
      }
    }
  }

  // Merge silent regions that are close together
  const mergedRegions = []
  let lastRegion = null
  for (let i = 0; i < silentRegions.length; i++) {
    if (lastRegion && silentRegions[i].start - lastRegion.end < mergeDuration) {
      lastRegion.end = silentRegions[i].end
    } else {
      lastRegion = silentRegions[i]
      mergedRegions.push(lastRegion)
    }
  }

  // Find regions that are not silent
  const regions = []
  let lastEnd = 0
  for (let i = 0; i < mergedRegions.length; i++) {
    regions.push({
      start: lastEnd,
      end: mergedRegions[i].start,
    })
    lastEnd = mergedRegions[i].end
  }

  return regions
}

// Create regions for each non-silent part of the audio
ws.on('decode', (duration) => {
  const decodedData = ws.getDecodedData()
  if (decodedData) {
    const regions = extractRegions(decodedData.getChannelData(0), duration)

    // Add regions to the waveform
    regions.forEach((region, index) => {
      wsRegions.addRegion({
        start: region.start,
        end: region.end,
        content: index.toString(),
        drag: false,
        resize: false,
      })
    })
  }
})

// Play a region on click
let activeRegion = null
wsRegions.on('region-clicked', (region, e) => {
  e.stopPropagation()
  region.play()
  activeRegion = region
})
ws.on('timeupdate', (currentTime) => {
  // When the end of the region is reached
  if (activeRegion && currentTime >= activeRegion.end) {
    // Stop playing
    ws.pause()
    activeRegion = null
  }
})*/
/*
wavesurfer.on('ready', function () {
    var totalAudioDuration = wavesurfer.getDuration();
    document.getElementById('time-total').innerText = totalAudioDuration.toFixed(1);

    readAndDecodeAudio();
});

wavesurferRegions.enableDragSelection({
    color: 'rgba(255, 0, 0, 0.1)',
});

wavesurferRegions.on('region-updated', (region) => {
    console.log('Updated region', region);
});

// Loop a region on click
let loop = true;
// Toggle looping with a checkbox
document.querySelector('input[type="checkbox"]').onclick = (e) => {
    loop = e.target.checked;
}

{
    let activeRegion = null;
    wavesurferRegions.on('region-in', (region) => {
        activeRegion = region;
    });
    wavesurferRegions.on('region-out', (region) => {
        if (activeRegion === region) {
            if (loop) {
                region.play();
            } else {
                activeRegion = null;
            }
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
}

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

wavesurfer.on('finish', setPlayButton);

//wavesurfer.load(URL.createObjectURL(element.files[0]));

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
    console.log('Created region', newRegion);
    newRegion.setContent(newRegion.id);
    var audioTracks = document.getElementById("audio-tracks").tBodies[0];
    console.log(audioTracks.childNodes);
    var tableRow = createAudioRow(new Array(newRegion.id, newRegion.start, newRegion.end));
    audioTracks.appendChild(tableRow);
    showAndHideMergeOption();
});

wavesurfer.on('region-update-end', (newRegion) => {
    document.getElementById(newRegion.id + 1).innerText =
        (0 >= newRegion.start.toFixed(3) ? 0 : newRegion.start.toFixed(3));
    document.getElementById(newRegion.id + 2).innerText =
        (wavesurfer.getDuration() <= newRegion.end ? wavesurfer.getDuration().toFixed(3) : newRegion.end.toFixed(3));
});



var audioButtons = document.getElementById("audio-button");
var audioButtonsClass = audioButtons.getAttribute("class").replace("w3-hide", "w3-show");
audioButtons.setAttribute("class", audioButtonsClass);

*/





let output = undefined;
// Whisper?!
function goPython() {
    $.ajax({
        type: 'GET',
        url: "../whisperAI.py",
        //data: { param: test }, // passing some input there
        dataType: "text",
        success: function (response) {
            output = response;
            alert(output);
        }
    }).done(function (data) {
        console.log(data);
        alert(data);
    });
}



// Elan Script
var ElanPlugin = function () {
    function ElanPlugin(params, ws) {
        _classCallCheck(this, ElanPlugin);
        _defineProperty(this, "Types", {
            ALIGNABLE_ANNOTATION: 'ALIGNABLE_ANNOTATION',
            REF_ANNOTATION: 'REF_ANNOTATION'
        });
        this.data = null;
        this.params = params;
        this.container = 'string' == typeof params.container ? document.querySelector(params.container) : params.container;
        if (!this.container) {
            throw Error('No container for ELAN');
        }
    }
}


function init() {
    this.bindClick();
    if (this.params.url) {
        this.load(this.params.url);
    }
}

function destroy() {
    this.container.removeEventListener('click', this._onClick);
    this.container.removeChild(this.table);
}

function load(url) {
    var _this = this;
    this.loadXML(url, function (xml) {
        _this.data = _this.parseElan(xml);
        _this.render();
        _this.fireEvent('ready', _this.data);
    });
}

function loadXML(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'document';
    xhr.send();
    xhr.addEventListener('load', function (e) {
        callback && callback(e.target.responseXML);
    });
}

function parseElan(xml) {
    var _this2 = this;
    var _forEach = Array.prototype.forEach;
    var _map = Array.prototype.map;
    var data = {
        media: {},
        timeOrder: {},
        tiers: [],
        annotations: {},
        alignableAnnotations: []
    };
    var header = xml.querySelector('HEADER');
    var inMilliseconds = header.getAttribute('TIME_UNITS') == 'milliseconds';
    var media = header.querySelector('MEDIA_DESCRIPTOR');
    data.media.url = media.getAttribute('MEDIA_URL');
    data.media.type = media.getAttribute('MIME_TYPE');
    var timeSlots = xml.querySelectorAll('TIME_ORDER TIME_SLOT');
    var timeOrder = {};
    _forEach.call(timeSlots, function (slot) {
        var value = parseFloat(slot.getAttribute('TIME_VALUE'));
        // If in milliseconds, convert to seconds with rounding
        if (inMilliseconds) {
            value = Math.round(value * 1e2) / 1e5;
        }
        timeOrder[slot.getAttribute('TIME_SLOT_ID')] = value;
    });
    data.tiers = _map.call(xml.querySelectorAll('TIER'), function (tier) {
        return {
            id: tier.getAttribute('TIER_ID'),
            linguisticTypeRef: tier.getAttribute('LINGUISTIC_TYPE_REF'),
            defaultLocale: tier.getAttribute('DEFAULT_LOCALE'),
            annotations: _map.call(tier.querySelectorAll('REF_ANNOTATION, ALIGNABLE_ANNOTATION'), function (node) {
                var annot = {
                    type: node.nodeName,
                    id: node.getAttribute('ANNOTATION_ID'),
                    ref: node.getAttribute('ANNOTATION_REF'),
                    value: node.querySelector('ANNOTATION_VALUE').textContent.trim()
                };
                if (_this2.Types.ALIGNABLE_ANNOTATION == annot.type) {
                    // Add start & end to alignable annotation
                    annot.start = timeOrder[node.getAttribute('TIME_SLOT_REF1')];
                    annot.end = timeOrder[node.getAttribute('TIME_SLOT_REF2')];
                    // Add to the list of alignable annotations
                    data.alignableAnnotations.push(annot);
                }

                // Additionally, put into the flat map of all annotations
                data.annotations[annot.id] = annot;
                return annot;
            })
        };
    });

    // Create JavaScript references between annotations
    data.tiers.forEach(function (tier) {
        tier.annotations.forEach(function (annot) {
            if (null != annot.ref) {
                annot.reference = data.annotations[annot.ref];
            }
        });
    });

    // Sort alignable annotations by start & end
    data.alignableAnnotations.sort(function (a, b) {
        var d = a.start - b.start;
        if (d == 0) {
            d = b.end - a.end;
        }
        return d;
    });
    data.length = data.alignableAnnotations.length;
    return data;
}

function render() {
    var _this3 = this;
    // apply tiers filter
    var tiers = this.data.tiers;
    if (this.params.tiers) {
        tiers = tiers.filter(function (tier) {
            return tier.id in _this3.params.tiers;
        });
    }

    // denormalize references to alignable annotations
    var backRefs = {};
    var indeces = {};
    tiers.forEach(function (tier, index) {
        tier.annotations.forEach(function (annot) {
            if (annot.reference && annot.reference.type == _this3.Types.ALIGNABLE_ANNOTATION) {
                if (!(annot.reference.id in backRefs)) {
                    backRefs[annot.ref] = {};
                }
                backRefs[annot.ref][index] = annot;
                indeces[index] = true;
            }
        });
    });
    indeces = Object.keys(indeces).sort();
    this.renderedAlignable = this.data.alignableAnnotations.filter(function (alignable) {
        return backRefs[alignable.id];
    });

    // table
    var table = this.table = document.createElement('table');
    table.className = 'wavesurfer-annotations';

    // head
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    thead.appendChild(headRow);
    table.appendChild(thead);
    var th = document.createElement('th');
    th.textContent = 'Time';
    th.className = 'wavesurfer-time';
    headRow.appendChild(th);
    indeces.forEach(function (index) {
        var tier = tiers[index];
        var th = document.createElement('th');
        th.className = 'wavesurfer-tier-' + tier.id;
        th.textContent = tier.id;
        if (_this3.params.tiers) {
            th.style.width = _this3.params.tiers[tier.id];
        }
        headRow.appendChild(th);
    });

    // body
    var tbody = document.createElement('tbody');
    table.appendChild(tbody);
    this.renderedAlignable.forEach(function (alignable) {
        var row = document.createElement('tr');
        row.id = 'wavesurfer-alignable-' + alignable.id;
        tbody.appendChild(row);
        var td = document.createElement('td');
        td.className = 'wavesurfer-time';
        td.textContent = alignable.start.toFixed(1) + '–' + alignable.end.toFixed(1);
        row.appendChild(td);
        var backRef = backRefs[alignable.id];
        indeces.forEach(function (index) {
            var tier = tiers[index];
            var td = document.createElement('td');
            var annotation = backRef[index];
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
    this.container.innerHTML = '';
    this.container.appendChild(table);
}

function bindClick() {
    var _this4 = this;
    this._onClick = function (e) {
        var ref = e.target.dataset.ref;
        if (null != ref) {
            var annot = _this4.data.annotations[ref];
            if (annot) {
                _this4.fireEvent('select', annot.start, annot.end);
            }
        }
    };
    this.container.addEventListener('click', this._onClick);
}

function getRenderedAnnotation(time) {
    var result;
    this.renderedAlignable.some(function (annotation) {
        if (annotation.start <= time && annotation.end >= time) {
            result = annotation;
            return true;
        }
        return false;
    });
    return result;
}

function getAnnotationNode(annotation) {
    return document.getElementById('wavesurfer-alignable-' + annotation.id);
}


const getBtn = document.getElementById('get-btn');
const postBtn = document.getElementById('post-btn');

const sendHttpRequest = (method, url, data) => {
    return fetch(url, {
        method: method,
        body: JSON.stringify(data),
        headers: data ? { 'Content-Type': 'application/json' } : {}
    }).then(response => {
        if (response.status >= 400) {
            // !response.ok
            return response.json().then(errResData => {
                const error = new Error('Something went wrong!');
                error.data = errResData;
                throw error;
            });
        }
        return response.json();
    });
};

const getData = () => {
    sendHttpRequest('GET', 'https://reqres.in/api/users').then(responseData => {
        console.log(responseData);
    });
};

const sendData = () => {
    sendHttpRequest('POST', 'https://reqres.in/api/register', {
        email: 'eve.holt@reqres.in'
        // password: 'pistol'
    })
        .then(responseData => {
            console.log(responseData);
        })
        .catch(err => {
            console.log(err, err.data);
        });
};

getBtn.addEventListener('click', getData);
postBtn.addEventListener('click', sendData);
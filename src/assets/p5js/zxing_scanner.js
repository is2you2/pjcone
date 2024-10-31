let capture;

const codeReader = new ZXing.BrowserMultiFormatReader();

function setup() {
  noCanvas();
  capture = createCapture(VIDEO);
  capture.size(400, 368);
  codeReader.listVideoInputDevices()
    .then(videoInputDevices => {
      const firstDeviceId = videoInputDevices[0].deviceId;
      codeReader.decodeFromVideoDevice(firstDeviceId, capture.elt, (result, err) => {
        if (result && window['scan_result']) window['scan_result'](result);
      })
    }).catch(err => console.error(err));
}
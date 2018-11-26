const axios = require('axios')

const httpClient = axios.create()

const URL = 'http://localhost:8000/orientation_photo.jpg'
const MEDIA_TYPE = 'image/jpeg'

// Exif orientation value to css transform mapping
// Does not include flipped orientations
const rotation = {
  1: 'rotate(0deg)',
  3: 'rotate(180deg)',
  6: 'rotate(90deg)',
  8: 'rotate(270deg)'
}

function getImage(url, mediaType) {
  return httpClient.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'Accept': mediaType,
    },
  })
  .then((response) => {
    return { buf: response.data, mediaType }
  })
}

function _arrayBufferToBase64( buffer ) {
  let binary = ''
  const bytes = new Uint8Array( buffer )
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode( bytes[ i ] )
  }
  return window.btoa( binary );
}

function orientation(src, mediaType) {
  return getImage(src, mediaType)
    .then((resp) => {
      const { buf, mediaType } = resp

      const base64img = "data:" + mediaType + ";base64," + _arrayBufferToBase64(buf);
      const scanner = new DataView(buf);
      let idx = 0;
      let value = 1; // Non-rotated is the default

      if (buf.length < 2 || scanner.getUint16(idx) !== 0xFFD8) {
          // Not a JPEG
          return { base64img, value };
      }
      idx += 2;

      let maxBytes = scanner.byteLength;
      let littleEndian = false;

      while (idx < maxBytes - 2) {
          const uint16 = scanner.getUint16(idx, littleEndian);
          idx += 2;
          switch (uint16) {
              case 0xFFE1: // Start of EXIF
                  const endianNess = scanner.getUint16(idx + 8);
                  // II (0x4949) Indicates Intel format - Little Endian
                  // MM (0x4D4D) Indicates Motorola format - Big Endian
                  if (endianNess === 0x4949) {
                      littleEndian = true;
                  }
                  const exifLength = scanner.getUint16(idx, littleEndian);
                  maxBytes = exifLength - idx;
                  idx += 2;
                  break;
              case 0x0112: // Orientation tag
                  // Read the value, its 6 bytes further out
                  // See page 102 at the following URL
                  // http://www.kodak.com/global/plugins/acrobat/en/service/digCam/exifStandard2.pdf
                  value = scanner.getUint16(idx + 6, littleEndian);
                  maxBytes = 0; // Stop scanning
                  break;
          }
      }
      return { base64img, value };
  })
}

orientation(URL, MEDIA_TYPE).then((base64img, value) => {
  const img = document.getElementById('img')
  img.src = base64img
  img.style = 'width: 100%; transform: '+rotation[value]
})

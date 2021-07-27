/**
 * Finds an object in a JSON result by identifier
 *
 * @param identifier
 * @param results
 * @param identifierAttribute
 */
export const findObjectInApiResults = (identifier, results, identifierAttribute = "@id") => {
    const members = results["hydra:member"];

    if (members === undefined) {
        return;
    }

    for (const object of members) {
        if (object[identifierAttribute] === identifier) {
            return object;
        }
    }
};

export const getPDFFileBase64Content = (file) => {
    return file.contentUrl.replace(/data:\s*application\/pdf;\s*base64,/, "");
};

export const convertDataURIToBinary = (dataURI) => {
    const BASE64_MARKER = ';base64,';
    const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    let array = new Uint8Array(rawLength);

    for(let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }

    return array;
};

export const getDataURIContentType = (dataURI) => {
    const BASE64_MARKER = ';base64,';
    const base64Index = dataURI.indexOf(BASE64_MARKER);

    return dataURI.substring(5, base64Index);
};

export const baseName = (str) =>
{
    let base = String(str).substring(str.lastIndexOf('/') + 1);

    if (base.lastIndexOf(".") !== -1) {
        base = base.substring(0, base.lastIndexOf("."));
    }

    return base;
};


export const fabricjs2pdfasPosition = (data) => {
    let angle = -(data.angle - 360) % 360;
    let bottom = data.bottom;
    let left = data.left;

    if (data.angle === 90) {
        bottom += data.height;
        left -= data.height;
    } else if (data.angle === 180) {
        bottom += data.height * 2;
    } else if (data.angle === 270) {
        bottom += data.height;
        left += data.height;
    }

    return {
        y: Math.round(bottom),
        x: Math.round(left),
        r: angle,
        w: Math.round(data.width), // only width, no "height" allowed in PDF-AS
        p: data.currentPage
    };
};

export function parseGreenPassQRCode(data, id) {
    // The QR code is of the format: "?$id:$hash"
    const searchHashString = `${id}:`;
    let index = data.search(searchHashString);
    if (index === -1)
        throw new Error('invalid green pass format');

    let passData = data.substring(index + searchHashString.length);
    if (passData === "")
        throw new Error('invalid green pass qr code');

    return data;
    
}

export function parseQRCode(data, id) {
    // The QR code is of the format: ".*?$id: -$hash(-$seat|-|)"
    const searchHashString = `${id}: -`;
    let index = data.search(searchHashString);
    if (index === -1)
        throw new Error('ID not found');
    let locationParam = data.substring(index + searchHashString.length);
    let split = locationParam.trim().split('-');
    if (split.length === 0  || split.length > 2)
        throw new Error('invalid list format');
    if (split.length === 1)
        split.push("");
    let location = split[0];
    let seatStr = split[1];
    let seat = null;
    if (location === "")
        throw new Error('invalid location format');
    if (seatStr === "")
        seat = null;
    else if (isNaN(parseInt(seatStr, 10)))
        throw new Error('invalid seat format');
    else
        seat = parseInt(seatStr, 10);
    return [location, seat];
}

/**
 * Escapes strings for regular expressions
 * see: https://stackoverflow.com/a/6969486/1581487
 *
 * @param string
 * @returns {string} escaped
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

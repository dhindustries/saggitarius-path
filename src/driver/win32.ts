
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

import { PathInfo } from "../pathinfo";

export let cwd = "";
export const env: Record<string, string> = {};
export const separator = "\\";
export const delimiter = ";";


function isString(value: any): value is string {
    return typeof(value) === "string";
}

function isObject(value: any): value is Record<string, string> {
    return typeof(value) === "object";
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts: string[], allowAboveRoot: boolean): string[] {
    let res = [];
    for (let i = 0; i < parts.length; i++) {
        let p = parts[i];

        // ignore empty parts
        if (!p || p === ".") {
            continue;
        }

        if (p === "..") {
            if (res.length && res[res.length - 1] !== "..") {
                res.pop();
            } else if (allowAboveRoot) {
                res.push("..");
            }
        } else {
            res.push(p);
        }
    }
    return res;
}

// returns an array with empty elements removed from either end of the input
// array or the original array if no elements need to be removed
function trimArray(arr: string[]): string[] {
    let lastIndex = arr.length - 1;
    let start = 0;
    for (; start <= lastIndex; start++) {
        if (arr[start]) {
            break;
        }
    }

    let end = lastIndex;
    for (; end >= 0; end--) {
        if (arr[end]) {
            break;
        }
    }

    if (start === 0 && end === lastIndex) {
        return arr;
    }
    if (start > end) {
        return [];
    }
    return arr.slice(start, end + 1);
}

// Regex to split a windows path into three parts: [*, device, slash,
// tail] windows-only
const splitDeviceRe =
    /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;

// Regex to split the tail part of the above into [*, dir, basename, ext]
const splitTailRe =
    /^([\s\S]*?)((?:\.{1,2}|[^\\\/]+?|)(\.[^.\/\\]*|))(?:[\\\/]*)$/;

// Function to split a filename into [root, dir, basename, ext]
function splitPath(filename: string): [string, string, string, string] {
    // Separate device+slash from tail
    const result = splitDeviceRe.exec(filename);
    const device = (result[1] || "") + (result[2] || "");
    const tail = result[3] || "";
    // Split the tail into dir, basename and extension
    const result2 = splitTailRe.exec(tail),
    dir = result2[1],
    basename = result2[2],
    ext = result2[3];
    return [device, dir, basename, ext];
}

type PathStat = {
    device: string,
    tail: string,
    isUnc: boolean,
    isAbsolute: boolean,
};

function statPath(path: string): PathStat {
    const result = splitDeviceRe.exec(path);
    const device = result[1] || "";
    const isUnc = !!device && device[1] !== ":";
    return {
        device: device,
        isUnc: isUnc,
        isAbsolute: isUnc || !!result[2], // UNC paths are always absolute
        tail: result[3]
    };
}

function normalizeUNCRoot(device: string): string {
    return "\\\\" + device.replace(/^[\\\/]+/, "").replace(/[\\\/]+/g, "\\");
}

// path.resolve([from ...], to)
export function resolve(...paths: string[]): string {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    let isUnc = false;

    for (let i = paths.length - 1; i >= -1; i--) {
        let path;
        if (i >= 0) {
            path = paths[i];
        } else if (!resolvedDevice) {
            path = cwd;
        } else {
            // Windows has the concept of drive-specific current working
            // directories. If we"ve resolved a drive letter but not yet an
            // absolute path, get cwd for that drive. We"re sure the device is not
            // an unc path at this points, because unc paths are always absolute.
            path = env["=" + resolvedDevice];
            // Verify that a drive-local cwd was found and that it actually points
            // to our drive. If not, default to the drive"s root.
            if (!path || path.substr(0, 3).toLowerCase() !== resolvedDevice.toLowerCase() + "\\") {
                path = resolvedDevice + "\\";
            }
        }

        // Skip empty and invalid entries
        if (!isString(path)) {
            throw new TypeError("Arguments to path.resolve must be strings");
        } else if (!path) {
            continue;
        }

        const result = statPath(path);
        let device = result.device;
        let isAbsolute = result.isAbsolute;
        let tail = result.tail;
        isUnc = result.isUnc;

        if (device && resolvedDevice && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            // This path points to another device so it is not applicable
            continue;
        }

        if (!resolvedDevice) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = tail + "\\" + resolvedTail;
            resolvedAbsolute = isAbsolute;
        }

        if (resolvedDevice && resolvedAbsolute) {
            break;
        }
    }

    // Convert slashes to backslashes when `resolvedDevice` points to an UNC
    // root. Also squash multiple slashes into a single one where appropriate.
    if (isUnc) {
        resolvedDevice = normalizeUNCRoot(resolvedDevice);
    }

    // At this point the path should be resolved to a full absolute path,
    // but handle relative paths to be safe (might happen when process.cwd()
    // fails)

    // Normalize the tail path
    resolvedTail = normalizeArray(resolvedTail.split(/[\\\/]+/), !resolvedAbsolute).join("\\");

    return (resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail) || ".";
}

export function normalize(path: string): string {
    const result = statPath(path);
    let device = result.device;
    const isUnc = result.isUnc;
    const isAbsolute = result.isAbsolute;
    let tail = result.tail;
    const trailingSlash = /[\\\/]$/.test(tail);
  
    // Normalize the tail path
    tail = normalizeArray(tail.split(/[\\\/]+/), !isAbsolute).join("\\");
  
    if (!tail && !isAbsolute) {
        tail = ".";
    }
    if (tail && trailingSlash) {
        tail += "\\";
    }
  
    // Convert slashes to backslashes when `device` points to an UNC root.
    // Also squash multiple slashes into a single one where appropriate.
    if (isUnc) {
        device = normalizeUNCRoot(device);
    }
  
    return device + (isAbsolute ? "\\" : "") + tail;
}

export function isAbsolute(path: string): boolean {
    return statPath(path).isAbsolute;
}

export function join(...paths: string[]): string {
    paths = paths.filter((arg) => {
        if (!isString(arg)) {
            throw new TypeError("Arguments to path.join must be strings");
        }
        return !!arg;
    });

    let joined = paths.join("\\");

    // Make sure that the joined path doesn"t start with two slashes, because
    // normalize() will mistake it for an UNC path then.
    //
    // This step is skipped when it is very clear that the user actually
    // intended to point at an UNC path. This is assumed when the first
    // non-empty string arguments starts with exactly two slashes followed by
    // at least one more non-slash character.
    //
    // Note that for normalize() to treat a path as an UNC path it needs to
    // have at least 2 components, so we don"t filter for that here.
    // This means that the user can use join to construct UNC paths from
    // a server name and a share name; for example:
    //   path.join("//server", "share") -> "\\\\server\\share\")
    if (!/^[\\\/]{2}[^\\\/]/.test(paths[0])) {
        joined = joined.replace(/^[\\\/]{2,}/, "\\");
    }

    return normalize(joined);
}


// path.relative(from, to)
// it will solve the relative path from "from" to "to", for instance:
// from = "C:\\orandea\\test\\aaa"
// to = "C:\\orandea\\impl\\bbb"
// The output of the function should be: "..\\..\\impl\\bbb"
export function relative(from: string, to: string): string {
    from = resolve(from);
    to = resolve(to);

    // windows is not case sensitive
    let lowerFrom = from.toLowerCase();
    let lowerTo = to.toLowerCase();

    let toParts = trimArray(to.split("\\"));

    let lowerFromParts = trimArray(lowerFrom.split("\\"));
    let lowerToParts = trimArray(lowerTo.split("\\"));

    let length = Math.min(lowerFromParts.length, lowerToParts.length);
    let samePartsLength = length;

    for (let i = 0; i < length; i++) {
        if (lowerFromParts[i] !== lowerToParts[i]) {
            samePartsLength = i;
            break;
        }
    }

    if (samePartsLength == 0) {
        return to;
    }

    let outputParts = [];
    for (var i = samePartsLength; i < lowerFromParts.length; i++) {
        outputParts.push("..");
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join("\\");
};


function _makeLong(path: string): string {
    // Note: this will *probably* throw somewhere.
    if (!isString(path)) {
        return path;
    }
    if (!path) {
        return "";
    }

    const resolvedPath = resolve(path);

    if (/^[a-zA-Z]\:\\/.test(resolvedPath)) {
        // path is local filesystem path, which needs to be converted
        // to long UNC path.
        return "\\\\?\\" + resolvedPath;
    } else if (/^\\\\[^?.]/.test(resolvedPath)) {
        // path is network UNC path, which needs to be converted
        // to long UNC path.
        return "\\\\?\\UNC\\" + resolvedPath.substring(2);
    }
    return path;
};


export function dirname(path: string): string {
    const result = splitPath(path);
    const root = result[0];
    let dir = result[1];

    if (!root && !dir) {
        // No dirname whatsoever
        return ".";
    }
    if (dir) {
        // It has a dirname, strip trailing slash
        dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
};


export function basename(path: string, ext: string): string {
    let f = splitPath(path)[2];
    if (ext && f.substr(-1 * ext.length).toLowerCase() === ext.toLowerCase()) {
        f = f.substr(0, f.length - ext.length);
    }
    return f;
};


export function extname(path: string): string {
    return splitPath(path)[3];
};


export function format(pathObject: PathInfo): string {
    if (!isObject(pathObject)) {
        throw new TypeError(
            "Parameter \"pathObject\" must be an object, not " + typeof pathObject
        );
    }

    const root = pathObject.root || "";

    if (!isString(root)) {
        throw new TypeError(
            "\"pathObject.root\" must be a string or undefined, not " +
            typeof pathObject.root
        );
    }

    const dir = pathObject.dir;
    const base = pathObject.base || "";
    if (!dir) {
        return base;
    }
    if (dir[dir.length - 1] === separator) {
        return dir + base;
    }
    return dir + separator + base;
};


export function parse(pathString: string): PathInfo {
    if (!isString(pathString)) {
        throw new TypeError(
            "Parameter \"pathString\" must be a string, not " + typeof pathString
        );
    }
    const allParts = splitPath(pathString);
    if (!allParts || allParts.length !== 4) {
        throw new TypeError("Invalid path \"" + pathString + "\"");
    }
    return {
        root: allParts[0],
        dir: allParts[0] + allParts[1].slice(0, -1),
        base: allParts[2],
        ext: allParts[3],
        name: allParts[2].slice(0, allParts[2].length - allParts[3].length)
    };
};
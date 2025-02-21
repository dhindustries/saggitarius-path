
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
export const separator = "/";
export const delimiter = ":";


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

// Split a filename into [root, dir, basename, ext], unix version
// "root" is just a slash, or nothing.
const splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;


function splitPath(filename: string): string[] {
    return splitPathRe.exec(filename).slice(1);
}

// path.resolve([from ...], to)
// posix version
export function resolve(...paths: string[]): string {
    let resolvedPath = "";
    let resolvedAbsolute = false;

    for (let i = paths.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        let path = (i >= 0) ? paths[i] : cwd;

        // Skip empty and invalid entries
        if (!isString(path)) {
            throw new TypeError("Arguments to path.resolve must be strings");
        } else if (!path) {
            continue;
        }

        resolvedPath = path + "/" + resolvedPath;
        resolvedAbsolute = path[0] === "/";
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(resolvedPath.split("/"),
    !resolvedAbsolute).join("/");

    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
}

// path.normalize(path)
// posix version
export function normalize(path: string): string {
    const isAbs = isAbsolute(path);
    const trailingSlash = path && path[path.length - 1] === "/";

    // Normalize the path
    path = normalizeArray(path.split("/"), !isAbs).join("/");

    if (!path && !isAbs) {
        path = ".";
    }
    if (path && trailingSlash) {
        path += "/";
    }

    return (isAbs ? "/" : "") + path;
}

// posix version
export function isAbsolute(path: string): boolean {
    return path.charAt(0) === "/";
}

// posix version
export function join(...paths: string[]): string {
    let path = "";
    for (let i = 0; i < paths.length; i++) {
        const segment = paths[i];
        if (!isString(segment)) {
            throw new TypeError("Arguments to path.join must be strings");
        }
        if (segment) {
            if (!path) {
                path += segment;
            } else {
                path += "/" + segment;
            }
        }
    }
    return normalize(path);
}


// path.relative(from, to)
// posix version
export function relative(from: string, to: string): string {
    from = resolve(from).substr(1);
    to = resolve(to).substr(1);

    const fromParts = trimArray(from.split("/"));
    const toParts = trimArray(to.split("/"));

    const length = Math.min(fromParts.length, toParts.length);
    let samePartsLength = length;
    for (let i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
        }
    }

    let outputParts = [];
    for (let i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push("..");
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join("/");
}


export function _makeLong(path: string): string {
    return path;
}


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
}


export function basename(path: string, ext: string): string {
    let f = splitPath(path)[2];
    if (ext && f.substr(-1 * ext.length) === ext) {
        f = f.substr(0, f.length - ext.length);
    }
    return f;
}


export function extname(path: string): string {
    return splitPath(path)[3];
}


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

    const dir = pathObject.dir ? pathObject.dir + separator : "";
    const base = pathObject.base || "";
    return dir + base;
}


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
    allParts[1] = allParts[1] || "";
    allParts[2] = allParts[2] || "";
    allParts[3] = allParts[3] || "";

    return {
        root: allParts[0],
        dir: allParts[0] + allParts[1].slice(0, -1),
        base: allParts[2],
        ext: allParts[3],
        name: allParts[2].slice(0, allParts[2].length - allParts[3].length)
    };
}

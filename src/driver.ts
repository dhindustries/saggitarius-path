import { PathInfo } from "./pathinfo";

export interface PathDriver {
    readonly separator: string;
    readonly delimiter: string;
    cwd: string;
    env?: Record<string, string>;

    join(...paths: string[]): string;
    normalize(path: string): string;
    isAbsolute(path: string): boolean;
    resolve(from: string, to: string): string;
    relative(from: string, to: string): string;
    dirname(path: string): string;
    extname(path: string): string;
    basename(path: string, ext: string): string;
    format(info: PathInfo): string;
    parse(path: string): PathInfo;
}

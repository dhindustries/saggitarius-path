
import { PathDriver } from "./driver";
import { PathInfo } from "./pathinfo";

export class Path {
    public static Driver: PathDriver;

    public static get separator(): string {
        return this.Driver.separator;    
    }

    public static get delimiter(): string {
        return this.Driver.delimiter;
    }

    public static join(...paths: string[]): string {
        return this.Driver.join(...paths);
    }

    public static normalize(path: string): string {
        return this.Driver.normalize(path);
    }

    public static isAbsolute(path: string): boolean {
        return this.Driver.isAbsolute(path);
    }

    public static resolve(from: string, to: string): string {
        return this.Driver.resolve(from, to);
    }
    
    public static relative(from: string, to: string): string {
        return this.Driver.relative(from, to); 
    }

    public static dirname(path: string): string {
        return this.Driver.dirname(path);
    }

    public static extname(path: string): string {
        return this.Driver.extname(path);
    }

    public static basename(path: string, ext: string): string {
        return this.Driver.basename(path, ext);
    }

    public static format(info: PathInfo): string {
        return this.Driver.format(info);
    }

    public static parse(path: string): PathInfo {
        return this.Driver.parse(path);
    }
}

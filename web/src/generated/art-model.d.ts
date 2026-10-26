export function catalog(): string;
export function settings(mode: number, seed: number, tilt: number, exposure: number): string;
export function indexForId(id: string): number;
export function main(args: string[]): void;
export function run(exercise: string, input: string): string;
export function reviewDays(successes: number, recalled: boolean): number;

export function camera(zoom:number,brightness:number,x:number,y:number):string;
export function orbit(azimuth:number,elevation:number,distance:number,brightness:number):string;

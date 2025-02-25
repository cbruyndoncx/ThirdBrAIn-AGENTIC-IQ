declare module 'html-to-image' {
    export function toPng(
        node: HTMLElement,
        options?: {
            width?: number;
            height?: number;
            backgroundColor?: string;
            style?: Record<string, string>;
        }
    ): Promise<string>;
}
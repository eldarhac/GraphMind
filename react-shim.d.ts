declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any;
  }
}
declare module 'react' {
  export interface FC<P = {}> {
    (props: P): JSX.Element | null;
  }
  export function useState<T>(initial: T): [T, (value: T) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export const createElement: any;
  export interface FormEvent<T = Element> { target: T; preventDefault(): void; }
  export interface ChangeEvent<T = Element> { target: T; }
  export interface KeyboardEvent<T = Element> { key: string; preventDefault(): void; }
  export const StrictMode: FC<{ children?: any }>;
}
declare module 'react/jsx-runtime';
declare module 'react-dom/client';

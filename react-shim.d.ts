declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any;
  }
  interface IntrinsicAttributes {
    key?: string | number;
  }
}
declare module 'react' {
  export interface FC<P = {}> {
    (props: P): JSX.Element | null;
  }
  export function useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initial?: T | null): { current: T | null };
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function forwardRef<T, P = {}>(
    render: (props: P, ref: { current: T | null }) => JSX.Element | null
  ): any;
  export const createElement: any;
  export interface FormEvent<T = Element> { target: T; preventDefault(): void; }
  export interface ChangeEvent<T = Element> { target: T; }
  export interface KeyboardEvent<T = Element> { key: string; preventDefault(): void; }
  export interface MouseEvent<T = Element> { target: T; preventDefault(): void; }
  export interface HTMLAttributes<T> { [key: string]: any; }
  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {}
  export interface InputHTMLAttributes<T> extends HTMLAttributes<T> {}
  export interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {}
  export interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {}
  export interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {}
  export const StrictMode: FC<{ children?: any }>;
}
declare module 'react/jsx-runtime';
declare module 'react-dom/client';

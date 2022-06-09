export declare type Handler<T> = (parameters: DecoratorParameters<T>) => Promise<unknown>;
export declare type Method<T> = (this: T, ...args: any[]) => Promise<any>;
export declare type Decorator<T> = <U extends T>(target: U, key: keyof U, descriptor: TypedPropertyDescriptor<Method<T>>) => TypedPropertyDescriptor<Method<T>>;
export interface DecoratorParameters<T, U extends any[] = any[]> {
    /**
     * Current call arguments.
     */
    args: U;
    /**
     * A callback to call the decorated method with the current arguments.
     */
    callback(): unknown;
    /**
     * Current call context.
     */
    instance: T;
}
/**
 * Applies decorating function to intercept decorated method calls.
 * @param fn - The decorating function.
 */
export declare function decorate<T>(fn: Handler<T>): Decorator<T>;

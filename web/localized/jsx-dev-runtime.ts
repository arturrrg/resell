export { Fragment } from "./jsx-runtime";
export type { JSX } from "react/jsx-runtime";
import { jsx, jsxs } from "./jsx-runtime";
export const jsxDEV = (type: Parameters<typeof jsx>[0], props: Parameters<typeof jsx>[1], key?: string, isStaticChildren?: boolean) => (isStaticChildren ? jsxs : jsx)(type, props, key);
